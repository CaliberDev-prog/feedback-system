import { getCsrfToken } from '../models/session.js';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function requireCsrf(request, env) {
  if (SAFE_METHODS.includes(request.method)) return null;
  const headerToken = request.headers.get('X-CSRF-Token');
  const cookieToken = getCsrfToken(request);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return 'Invalid or missing CSRF token.';
  }
  return null;
}
