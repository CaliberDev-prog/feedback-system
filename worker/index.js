import {
  handleSubmit,
  handleGetSubmissions,
  handleGetSubmission,
  handleArchiveSubmission,
  handleUnarchiveSubmission,
  handleDeleteSubmission,
  handleAddNotes,
  handleGetAnalytics,
  handleExport,
  handleGetActivity,
} from './submissions.js';

import {
  handleLogin,
  handleLogout,
  requireAuth,
} from './auth.js';

import {
  checkRateLimit,
  getClientIp,
  corsHeaders,
  securityHeaders,
  jsonResponse,
  errorResponse,
} from './utils.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const origin = env.CORS_ORIGIN || '';

    if (method === 'OPTIONS') {
      return handleCorsPreflight(origin);
    }

    try {
      const result = await handleRoute(method, path, request, env, origin);
      if (result) return result;
    } catch (err) {
      console.error('Unhandled error:', err);
      return errorResponse('Internal server error.', 500, origin);
    }

    return serveStatic(request, env, url);
  },
};

async function handleRoute(method, path, request, env, origin) {
  const apiPattern = /^\/api\//;
  if (!apiPattern.test(path)) {
    return null;
  }

  const rateLimitResult = checkRateLimit(
    getClientIp(request),
    path,
    parseInt(env.RATE_LIMIT_MAX) || 20,
    parseInt(env.RATE_LIMIT_WINDOW) || 60
  );

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter),
          ...corsHeaders(origin),
          ...securityHeaders(),
        },
      }
    );
  }

  if (path === '/api/submit' && method === 'POST') {
    return handleSubmit(request, env);
  }

  if (path.startsWith('/api/admin/')) {
    if (path === '/api/admin/login' && method === 'POST') {
      return handleLogin(request, env);
    }

    const session = await requireAuth(request, env);
    if (!session) {
      return errorResponse('Unauthorized. Please log in.', 401, origin);
    }

    if (path === '/api/admin/logout' && method === 'POST') {
      return handleLogout(request, env);
    }

    if (path === '/api/admin/session' && method === 'GET') {
      return jsonResponse({ valid: true, expiresAt: session.expiresAt }, 200, origin);
    }

    if (path === '/api/admin/submissions' && method === 'GET') {
      return handleGetSubmissions(request, env);
    }

    if (path === '/api/admin/analytics' && method === 'GET') {
      return handleGetAnalytics(request, env);
    }

    if (path === '/api/admin/export' && method === 'GET') {
      return handleExport(request, env);
    }

    if (path === '/api/admin/activity' && method === 'GET') {
      return handleGetActivity(request, env);
    }

    const subMatch = path.match(/^\/api\/admin\/submissions\/([a-z0-9]+)(?:\/(\w+))?$/);
    if (subMatch) {
      const id = subMatch[1];
      const action = subMatch[2];

      if (!action && method === 'GET') {
        return handleGetSubmission(request, env, id);
      }

      if (!action && method === 'DELETE') {
        return handleDeleteSubmission(request, env, id);
      }

      if (action === 'archive' && method === 'POST') {
        return handleArchiveSubmission(request, env, id);
      }

      if (action === 'unarchive' && method === 'POST') {
        return handleUnarchiveSubmission(request, env, id);
      }

      if (action === 'notes' && method === 'POST') {
        return handleAddNotes(request, env, id);
      }
    }
  }

  return errorResponse('Not found.', 404, origin);
}

function handleCorsPreflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      ...securityHeaders(),
    },
  });
}

async function serveStatic(request, env, url) {
  if (env.ASSETS) {
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) {
        const headers = new Headers(response.headers);
        const secHeaders = securityHeaders();
        for (const [key, value] of Object.entries(secHeaders)) {
          headers.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
    } catch {
    }
  }

  return new Response('Not found.', {
    status: 404,
    headers: { ...securityHeaders() },
  });
}

export function isAuthenticated(request, env) {
  return requireAuth(request, env);
}
