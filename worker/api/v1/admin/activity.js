import { getActivity } from '../../../models/activity.js';
import { requirePermission } from '../../../middleware/auth.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function handleGetActivity(request, env) {
  const session = await requirePermission(request, env, 'audit.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const activity = await getActivity(env, limit);

  return jsonResponse({ activity }, 200, env.CORS_ORIGIN);
}
