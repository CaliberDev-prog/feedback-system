import { getSubmissionAnalytics } from '../../../models/submission.js';
import { requirePermission } from '../../../middleware/auth.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function handleGetAnalytics(request, env) {
  const session = await requirePermission(request, env, 'analytics.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);

  const analytics = await getSubmissionAnalytics(env);
  return jsonResponse(analytics, 200, env.CORS_ORIGIN);
}
