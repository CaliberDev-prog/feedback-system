import { generateId } from '../utils/crypto.js';
import { sanitizeString, sanitizeAnswers, formatDiscordValue } from '../utils/sanitize.js';

export async function createSubmission(env, data) {
  const id = generateId(16);
  const discord = data.discord ? sanitizeString(String(data.discord), 37) : '';
  const answers = sanitizeAnswers(data.answers);
  const timestamp = Date.now();
  const ip = data.ip || '';

  await env.DB.prepare(
    'INSERT INTO submissions (id, discord, timestamp, ip) VALUES (?, ?, ?, ?)'
  ).bind(id, discord, timestamp, ip).run();

  for (const answer of answers) {
    const aid = generateId(16);
    const val = Array.isArray(answer.value) ? JSON.stringify(answer.value) : String(answer.value);
    await env.DB.prepare(
      'INSERT INTO submission_answers (id, submission_id, question_id, question_type, label, value) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(aid, id, answer.id, answer.type, answer.label, val).run();
  }

  return { id, discord, answers, timestamp, archived: false, notes: '' };
}

export async function getSubmissions(env, opts = {}) {
  const { search, archived, page = 1, limit = 50, sortBy = 'timestamp', sortDir = 'desc' } = opts;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (archived === 'true') conditions.push('s.archived = 1');
  else if (archived === 'false') conditions.push('s.archived = 0');
  else conditions.push('s.archived = 0');

  if (search) {
    conditions.push('(s.discord LIKE ? OR a.value LIKE ? OR a.label LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countSql = `SELECT COUNT(DISTINCT s.id) as total FROM submissions s LEFT JOIN submission_answers a ON a.submission_id = s.id ${where}`;
  const countResult = await env.DB.prepare(countSql).bind(...params).first();
  const total = countResult.total;

  const sql = `SELECT DISTINCT s.id, s.discord, s.timestamp, s.archived, s.notes
    FROM submissions s LEFT JOIN submission_answers a ON a.submission_id = s.id
    ${where} ORDER BY s.${sortBy} ${sortDir} LIMIT ? OFFSET ?`;
  const rows = await env.DB.prepare(sql).bind(...params, limit, offset).all();

  const submissions = [];
  for (const row of rows.results) {
    const ansRows = await env.DB.prepare(
      'SELECT question_id, question_type, label, value FROM submission_answers WHERE submission_id = ?'
    ).bind(row.id).all();

    const answers = ansRows.results.map(r => ({
      id: r.question_id,
      type: r.question_type,
      label: r.label,
      value: parseAnswerValue(r.value, r.question_type),
    }));

    submissions.push({
      id: row.id,
      discord: row.discord || '',
      answers,
      timestamp: row.timestamp,
      archived: !!row.archived,
      hasNotes: !!row.notes,
    });
  }

  return { submissions, total, page, limit };
}

export async function getSubmission(env, id) {
  const row = await env.DB.prepare(
    'SELECT id, discord, timestamp, archived, notes, ip FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!row) return null;

  const ansRows = await env.DB.prepare(
    'SELECT question_id, question_type, label, value FROM submission_answers WHERE submission_id = ?'
  ).bind(id).all();

  const answers = ansRows.results.map(r => ({
    id: r.question_id,
    type: r.question_type,
    label: r.label,
    value: parseAnswerValue(r.value, r.question_type),
  }));

  return {
    id: row.id,
    discord: row.discord || '',
    answers,
    timestamp: row.timestamp,
    archived: !!row.archived,
    notes: row.notes || '',
    ip: row.ip || '',
  };
}

export async function updateSubmissionField(env, id, field, value) {
  const allowed = ['archived', 'notes'];
  if (!allowed.includes(field)) return null;
  await env.DB.prepare(`UPDATE submissions SET ${field} = ? WHERE id = ?`).bind(value, id).run();
  return true;
}

export async function deleteSubmission(env, id) {
  await env.DB.prepare('DELETE FROM submission_answers WHERE submission_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
}

export async function getSubmissionAnalytics(env) {
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as week,
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as month
    FROM submissions
  `).bind(
    Date.now() - 86400000,
    Date.now() - 7 * 86400000,
    Date.now() - 30 * 86400000
  ).first();

  const timeline = await env.DB.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(timestamp / 1000, 'unixepoch')) as date,
      COUNT(*) as count
    FROM submissions
    WHERE timestamp > ?
    GROUP BY date ORDER BY date ASC
  `).bind(Date.now() - 7 * 86400000).all();

  const ratings = await env.DB.prepare(`
    SELECT value, COUNT(*) as count FROM submission_answers
    WHERE question_type = 'rating' AND submission_id IN (
      SELECT id FROM submissions WHERE timestamp > ?
    )
    GROUP BY value ORDER BY value DESC
  `).bind(Date.now() - 90 * 86400000).all();

  const ratingDistribution = {};
  let totalRating = 0;
  let ratingCount = 0;
  for (const r of ratings.results) {
    const num = parseInt(r.value);
    if (!isNaN(num)) {
      ratingDistribution[num] = r.count;
      totalRating += num * r.count;
      ratingCount += r.count;
    }
  }

  const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;

  return {
    stats: { total: stats.total, today: stats.today, week: stats.week, month: stats.month },
    timeline: timeline.results,
    ratingDistribution,
    averageRating,
    ratingCount,
  };
}

export async function getExportData(env, includeArchived = false) {
  const where = includeArchived ? '' : 'WHERE archived = 0';
  const rows = await env.DB.prepare(`SELECT id, discord, timestamp, archived FROM submissions ${where} ORDER BY timestamp DESC`).all();

  const submissions = [];
  for (const row of rows.results) {
    const ansRows = await env.DB.prepare(
      'SELECT question_id, question_type, label, value FROM submission_answers WHERE submission_id = ?'
    ).bind(row.id).all();
    submissions.push({
      id: row.id,
      discord: row.discord || '',
      timestamp: row.timestamp,
      archived: !!row.archived,
      answers: ansRows.results.map(r => ({
        id: r.question_id,
        type: r.question_type,
        label: r.label,
        value: parseAnswerValue(r.value, r.question_type),
      })),
    });
  }
  return submissions;
}

function parseAnswerValue(value, type) {
  if (type === 'checkboxes') {
    try { return JSON.parse(value); } catch { return []; }
  }
  if (type === 'rating') return parseInt(value) || 0;
  return value;
}
