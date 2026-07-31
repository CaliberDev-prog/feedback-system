export function corsHeaders(origin) {
  const allowedOrigin = origin || '*';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
  };
  if (allowedOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' *; " +
      "frame-ancestors 'none';",
  };
}

export function jsonResponse(data, status = 200, origin = '', extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status = 400, origin = '', extraHeaders = {}) {
  return jsonResponse({ error: message }, status, origin, extraHeaders);
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders(),
    },
  });
}

export function redirectResponse(url, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: url, ...securityHeaders() },
  });
}
