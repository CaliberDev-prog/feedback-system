export function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    request.headers.get('X-Real-IP') ||
    '127.0.0.1'
  );
}

export function getUserAgent(request) {
  return request.headers.get('User-Agent') || '';
}
