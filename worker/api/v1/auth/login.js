import { authenticateAdmin, updateLastLogin } from '../../../models/admin.js';
import { createSession, setSessionCookies, setCsrfCookie } from '../../../models/session.js';
import { logActivity } from '../../../models/activity.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { getClientIp } from '../../../utils/ip.js';

export async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { password } = body;
    if (!password || typeof password !== 'string') {
      return errorResponse('Password is required.', 400, env.CORS_ORIGIN);
    }
    const admin = await authenticateAdmin(env, password);
    if (!admin) {
      await logActivity(env, 'login_failed', { details: { reason: 'invalid_password' }, ip: getClientIp(request) });
      return errorResponse('Invalid password.', 401, env.CORS_ORIGIN);
    }
    const { sessionId, token, csrfToken, sessionData } = await createSession(env, admin, request);
    await updateLastLogin(env, admin.id, getClientIp(request));
    await logActivity(env, 'login_success', { adminId: admin.id, adminUsername: admin.username, ip: getClientIp(request) });
    const sessionTtl = parseInt(env.ADMIN_SESSION_TTL) || 86400;
    const response = jsonResponse({
      session: sessionId,
      token,
      csrfToken,
      admin: { username: admin.username, role: admin.role },
      expiresAt: sessionData.expiresAt,
    }, 200, env.CORS_ORIGIN);
    setSessionCookies(response, sessionId, token, csrfToken, sessionTtl);
    setCsrfCookie(response, csrfToken, sessionTtl);
    return response;
  } catch (err) {
    return errorResponse('Invalid request.', 400, env.CORS_ORIGIN);
  }
}
