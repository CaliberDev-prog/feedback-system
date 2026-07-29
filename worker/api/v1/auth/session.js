import { requireAuth } from '../../../middleware/auth.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function handleCheckSession(request, env) {
  const session = await requireAuth(request, env);
  if (!session) {
    return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  }
  return jsonResponse({
    valid: true,
    admin: { username: session.username, role: session.role },
    expiresAt: session.expiresAt,
  }, 200, env.CORS_ORIGIN);
}
