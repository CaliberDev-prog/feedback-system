import {
  getConfig, getAllConfig, setConfigDraft, publishAllConfig,
  discardDraft, getConfigVersions, restoreVersion, CONFIG_KEYS
} from '../../../../models/config.js';
import { requireAuth, requirePermission } from '../../../../middleware/auth.js';
import { requireCsrf } from '../../../../middleware/csrf.js';
import { jsonResponse, errorResponse } from '../../../../utils/response.js';

export async function handleGetConfig(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const live = new URL(request.url).searchParams.get('live') !== 'false';
  const config = await getAllConfig(env, live);
  return jsonResponse(config, 200, env.CORS_ORIGIN);
}

export async function handleUpdateBranding(request, env) {
  return handleUpdateConfig(request, env, 'branding');
}

export async function handleUpdateQuestions(request, env) {
  return handleUpdateConfig(request, env, 'questions');
}

export async function handleUpdateDiscord(request, env) {
  return handleUpdateConfig(request, env, 'discord');
}

export async function handleUpdateSettings(request, env) {
  return handleUpdateConfig(request, env, 'settings');
}

async function handleUpdateConfig(request, env, key) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const hasPerm = await requirePermission(request, env, 'settings.manage');
  if (!hasPerm) return errorResponse('Forbidden.', 403, env.CORS_ORIGIN);

  const csrfErr = requireCsrf(request, env);
  if (csrfErr) return errorResponse(csrfErr, 400, env.CORS_ORIGIN);

  try {
    const body = await request.json();
    await setConfigDraft(env, key, body, session.adminId, session.username);
    return jsonResponse({ success: true, key }, 200, env.CORS_ORIGIN);
  } catch (e) {
    return errorResponse('Invalid request body.', 400, env.CORS_ORIGIN);
  }
}

export async function handlePublishAll(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const hasPerm = await requirePermission(request, env, 'settings.manage');
  if (!hasPerm) return errorResponse('Forbidden.', 403, env.CORS_ORIGIN);
  const csrfErr = requireCsrf(request, env);
  if (csrfErr) return errorResponse(csrfErr, 400, env.CORS_ORIGIN);
  await publishAllConfig(env, session.adminId, session.username);
  return jsonResponse({ success: true, message: 'All changes published.' }, 200, env.CORS_ORIGIN);
}

export async function handleDiscardDraft(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const hasPerm = await requirePermission(request, env, 'settings.manage');
  if (!hasPerm) return errorResponse('Forbidden.', 403, env.CORS_ORIGIN);
  const csrfErr = requireCsrf(request, env);
  if (csrfErr) return errorResponse(csrfErr, 400, env.CORS_ORIGIN);
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (key && CONFIG_KEYS.includes(key)) {
    await discardDraft(env, key);
  } else {
    for (const k of CONFIG_KEYS) await discardDraft(env, k);
  }
  return jsonResponse({ success: true, message: 'Draft discarded.' }, 200, env.CORS_ORIGIN);
}

export async function handleGetVersions(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || 'questions';
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const versions = await getConfigVersions(env, key, limit);
  return jsonResponse(versions, 200, env.CORS_ORIGIN);
}

export async function handleRestoreVersion(request, env, ctx) {
  const session = await requireAuth(request, env);
  if (!session) return errorResponse('Unauthorized.', 401, env.CORS_ORIGIN);
  const hasPerm = await requirePermission(request, env, 'settings.manage');
  if (!hasPerm) return errorResponse('Forbidden.', 403, env.CORS_ORIGIN);
  const csrfErr = requireCsrf(request, env);
  if (csrfErr) return errorResponse(csrfErr, 400, env.CORS_ORIGIN);
  const url = new URL(request.url);
  const versionId = url.pathname.split('/').pop();
  if (!versionId) return errorResponse('Version ID required.', 400, env.CORS_ORIGIN);
  const restored = await restoreVersion(env, versionId, session.adminId, session.username);
  if (!restored) return errorResponse('Version not found.', 404, env.CORS_ORIGIN);
  return jsonResponse({ success: true, message: 'Version restored to draft.' }, 200, env.CORS_ORIGIN);
}
