import { destroySession, clearSessionCookies } from '../../../models/session.js';
import { requireAuth } from '../../../middleware/auth.js';
import { logActivity } from '../../../models/activity.js';
import { jsonResponse } from '../../../utils/response.js';

export async function handleLogout(request, env) {
  const session = await requireAuth(request, env);
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
