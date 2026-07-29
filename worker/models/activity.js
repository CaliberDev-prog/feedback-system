import { generateId } from '../utils/crypto.js';

export async function logActivity(env, action, opts = {}) {
  if (!env.DB) return;
  try {
    const id = generateId(16);
    const timestamp = Date.now();
    const { adminId = '', adminUsername = '', submissionId = '', details = '{}', ip = '' } = opts;

    await env.DB.prepare(
      'INSERT INTO activity_log (id, timestamp, action, admin_id, admin_username, submission_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, timestamp, action, adminId, adminUsername, submissionId, JSON.stringify(details), ip).run();
  } catch {}
}

export async function getActivity(env, limit = 100) {
  if (!env.DB) return [];
  const rows = await env.DB.prepare(
    'SELECT id, timestamp, action, admin_username, submission_id, details FROM activity_log ORDER BY timestamp DESC LIMIT ?'
  ).bind(Math.min(limit, 200)).all();

  return rows.results.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    action: r.action,
    adminUsername: r.admin_username || '',
    submissionId: r.submission_id || '',
    details: r.details ? JSON.parse(r.details) : {},
  }));
}
