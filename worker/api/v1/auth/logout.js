import { destroySession, clearSessionCookies } from '../../../models/session.js';
import { requireAuth } from '../../../middleware/auth.js';
import { requireCsrf } from '../../../middleware/csrf.js';
import { logActivity } from '../../../models/activity.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function handleLogout(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const csrfErr = requireCsrf(request, env);
  if (csrfErr) return errorResponse(csrfErr, 400, env.CORS_ORIGIN);
  if (session) {
    await logActivity(env, 'logout', {
      adminId: session.adminId,
      adminUsername: session.username,
    });
  }

  await destroySession(request, env);
  const response = jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
  clearSessionCookies(response);
  return response;
}
