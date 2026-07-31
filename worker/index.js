import { initializeDatabase } from './database/index.js';
import { createRouter } from './router.js';
import { checkRateLimit } from './middleware/rate-limit-kv.js';
import { corsHeaders, securityHeaders, jsonResponse, errorResponse } from './utils/response.js';
import { getClientIp } from './utils/ip.js';

let initialized = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const origin = env.CORS_ORIGIN || '';

    try {
      if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...corsHeaders(origin), ...securityHeaders() } });
      }

      if (path.startsWith('/api/')) {
        if (!initialized) {
          await initializeDatabase(env);
          initialized = true;
        }

        const rl = await checkRateLimit(env, getClientIp(request), path);
        if (!rl.allowed) {
          return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(rl.retryAfter),
              ...corsHeaders(origin),
              ...securityHeaders(),
            },
          });
        }
      }

      const router = createRouter();
      const result = await router.resolve(method, path, request, env, ctx);
      if (result) return result;

      if (env.ASSETS) {
        try {
          const response = await env.ASSETS.fetch(request);
          if (response.status !== 404) {
            const headers = new Headers(response.headers);
            for (const [k, v] of Object.entries(securityHeaders())) headers.set(k, v);
            const type = headers.get('Content-Type') || '';
            if (type.includes('text/html')) {
              headers.set('Cache-Control', 'no-cache');
            } else if (!headers.has('Cache-Control')) {
              headers.set('Cache-Control', 'public, max-age=3600');
            }
            return new Response(response.body, { status: response.status, headers });
          }
        } catch {}
      }

      return new Response('Not found.', { status: 404, headers: { ...securityHeaders() } });
    } catch (err) {
      console.error('Unhandled error:', err);
      if (err && err.stack) console.error(err.stack);
      return errorResponse('Internal server error.', 500, origin);
    }
  },
};
