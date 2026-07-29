import { initializeDatabase } from './database/index.js';
import { createRouter } from './router.js';
import { checkRateLimit } from './middleware/rate-limit.js';
import { corsHeaders, securityHeaders, jsonResponse, errorResponse } from './utils/response.js';
import { getClientIp } from './utils/ip.js';

let dbInitialized = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const origin = env.CORS_ORIGIN || '';

    // Initialize DB on first request
    if (!dbInitialized) {
      ctx.waitUntil(
        initializeDatabase(env).then(() => { dbInitialized = true; })
      );
    }

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleCorsPreflight(origin);
    }

    // Try API routing
    try {
      const router = createRouter();
      const result = await router.resolve(method, path, request, env);

      if (result) {
        // Apply rate limiting to all API routes
        if (path.startsWith('/api/')) {
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
        }

        return result;
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      return errorResponse('Internal server error.', 500, origin);
    }

    // Static assets
    return serveStatic(request, env, url);
  },
};

function handleCorsPreflight(origin) {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(origin), ...securityHeaders() },
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
        return new Response(response.body, { status: response.status, headers });
      }
    } catch {}
  }

  return new Response('Not found.', {
    status: 404,
    headers: { ...securityHeaders() },
  });
}
