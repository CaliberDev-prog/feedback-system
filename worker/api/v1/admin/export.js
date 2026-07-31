import { getExportData } from '../../../models/submission.js';
import { generateCSV } from '../../../services/export.js';
import { getConfig } from '../../../models/config.js';
import { logActivity } from '../../../models/activity.js';
import { requirePermission } from '../../../middleware/auth.js';
import { jsonResponse, errorResponse, securityHeaders, corsHeaders } from '../../../utils/response.js';

export async function handleExport(request, env) {
  const session = await requirePermission(request, env, 'submission.export');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'csv';
  const includeArchived = url.searchParams.get('archived') === 'true';
  const settings = await getConfig(env, 'settings');
  const maxSize = Math.max(1, parseInt(settings.maxExportSize) || 10000);

  const submissions = await getExportData(env, includeArchived, maxSize);
  if (submissions.length === 0) {
    return errorResponse('No submissions found.', 404, env.CORS_ORIGIN);
  }

  await logActivity(env, 'export', {
    adminId: session.adminId,
    adminUsername: session.username,
    details: { format, count: submissions.length },
  });

  if (format === 'json') {
    return jsonResponse(submissions, 200, env.CORS_ORIGIN);
  }

  const csv = generateCSV(submissions);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="feedback-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...corsHeaders(env.CORS_ORIGIN),
      ...securityHeaders(),
    },
  });
}
