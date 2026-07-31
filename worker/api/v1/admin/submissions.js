import { getSubmissions, getSubmission, updateSubmissionField, deleteSubmission } from '../../../models/submission.js';
import { logActivity } from '../../../models/activity.js';
import { requirePermission } from '../../../middleware/auth.js';
import { requireCsrf } from '../../../middleware/csrf.js';
import { jsonResponse, errorResponse } from '../../../utils/response.js';

function csrfGuard(request, env) {
  const csrfErr = requireCsrf(request, env);
  return csrfErr ? errorResponse(csrfErr, 400, env.CORS_ORIGIN) : null;
}

export async function handleGetSubmissions(request, env) {
  const session = await requirePermission(request, env, 'submission.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const archived = url.searchParams.get('archived');
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);

  const result = await getSubmissions(env, { search, archived, page, limit });
  return jsonResponse(result, 200, env.CORS_ORIGIN);
}

export async function handleGetSubmission(request, env, ctx, id) {
  const session = await requirePermission(request, env, 'submission.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);

  const sub = await getSubmission(env, id);
  if (!sub) return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);

  return jsonResponse(sub, 200, env.CORS_ORIGIN);
}

export async function handleArchiveSubmission(request, env, ctx, id) {
  const session = await requirePermission(request, env, 'submission.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const csrfErr = csrfGuard(request, env);
  if (csrfErr) return csrfErr;

  const result = await updateSubmissionField(env, id, 'archived', 1);
  if (result === null) return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);

  await logActivity(env, 'submission_archived', {
    adminId: session.adminId,
    adminUsername: session.username,
    submissionId: id,
  });

  return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
}

export async function handleUnarchiveSubmission(request, env, ctx, id) {
  const session = await requirePermission(request, env, 'submission.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const csrfErr = csrfGuard(request, env);
  if (csrfErr) return csrfErr;

  const result = await updateSubmissionField(env, id, 'archived', 0);
  if (result === null) return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);

  await logActivity(env, 'submission_unarchived', {
    adminId: session.adminId,
    adminUsername: session.username,
    submissionId: id,
  });

  return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
}

export async function handleDeleteSubmission(request, env, ctx, id) {
  const session = await requirePermission(request, env, 'submission.delete');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const csrfErr = csrfGuard(request, env);
  if (csrfErr) return csrfErr;

  const sub = await getSubmission(env, id);
  if (!sub) return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);

  await deleteSubmission(env, id);

  await logActivity(env, 'submission_deleted', {
    adminId: session.adminId,
    adminUsername: session.username,
    submissionId: id,
  });

  return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
}

export async function handleAddNotes(request, env, ctx, id) {
  const session = await requirePermission(request, env, 'submission.view');
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const csrfErr = csrfGuard(request, env);
  if (csrfErr) return csrfErr;

  try {
    const body = await request.json();
    const notes = body.notes ? String(body.notes).replace(/[<>]/g, '').trim().slice(0, 5000) : '';
    const result = await updateSubmissionField(env, id, 'notes', notes);
    if (result === null) return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);

    await logActivity(env, 'notes_added', {
      adminId: session.adminId,
      adminUsername: session.username,
      submissionId: id,
    });

    return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
  } catch {
    return errorResponse('Invalid request.', 400, env.CORS_ORIGIN);
  }
}
