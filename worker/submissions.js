import { generateId, sanitizeString, jsonResponse, errorResponse } from './utils.js';

export async function handleSubmit(request, env) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid submission data.', 400, env.CORS_ORIGIN);
    }

    const discord = body.discord ? sanitizeString(String(body.discord), 37) : '';
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (answers.length === 0) {
      return errorResponse('No answers provided.', 400, env.CORS_ORIGIN);
    }

    const sanitizedAnswers = answers.map((a) => ({
      id: sanitizeString(a.id, 64),
      type: sanitizeString(a.type, 32),
      label: sanitizeString(a.label, 256),
      value: sanitizeAnswerValue(a),
      required: !!a.required,
      min: a.min,
      max: a.max,
      options: a.options,
    }));

    const submission = {
      id: generateId(16),
      discord: discord,
      answers: sanitizedAnswers,
      timestamp: Date.now(),
      archived: false,
      notes: '',
      ip: request.headers.get('CF-Connecting-IP') || '',
    };

    await storeSubmission(env, submission);
    await sendToDiscord(env, submission);

    await logSubmissionActivity(env, 'submission_created', submission.id);

    return jsonResponse({
      success: true,
      id: submission.id,
      message: 'Thank you for your feedback!',
    }, 201, env.CORS_ORIGIN);
  } catch (err) {
    return errorResponse('Failed to process submission.', 500, env.CORS_ORIGIN);
  }
}

function sanitizeAnswerValue(answer) {
  switch (answer.type) {
    case 'rating':
      return Math.max(1, Math.min(10, parseInt(answer.value) || 0));
    case 'text':
    case 'textarea':
      return sanitizeString(String(answer.value || ''), 2000);
    case 'select':
    case 'dropdown':
      return sanitizeString(String(answer.value || ''), 256);
    case 'checkboxes':
      return Array.isArray(answer.value)
        ? answer.value.map((v) => sanitizeString(String(v), 256))
        : [];
    case 'yesno':
      const v = String(answer.value).toLowerCase();
      return (v === 'yes' || v === 'true') ? 'Yes' : 'No';
    default:
      return sanitizeString(String(answer.value || ''), 256);
  }
}

async function storeSubmission(env, submission) {
  if (!env.FEEDBACK_KV) return;

  const submissionKey = `submission:${submission.id}`;
  await env.FEEDBACK_KV.put(submissionKey, JSON.stringify(submission), {
    expirationTtl: 7776000,
  });

  const indexStr = await env.FEEDBACK_KV.get('submissions:index');
  let index = [];
  if (indexStr) {
    try { index = JSON.parse(indexStr); } catch { index = []; }
  }

  index.unshift({
    id: submission.id,
    timestamp: submission.timestamp,
    archived: submission.archived,
  });

  if (index.length > 10000) {
    index = index.slice(0, 10000);
  }

  await env.FEEDBACK_KV.put('submissions:index', JSON.stringify(index), {
    expirationTtl: 7776000,
  });

  await updateSubmissionStats(env, submission);
}

async function updateSubmissionStats(env, submission) {
  if (!env.FEEDBACK_KV) return;

  const statsStr = await env.FEEDBACK_KV.get('analytics:stats');
  let stats = statsStr ? JSON.parse(statsStr) : { total: 0, today: 0, week: 0, month: 0 };

  stats.total = (stats.total || 0) + 1;

  const now = Date.now();
  const day = 86400000;
  if (now - submission.timestamp < day) stats.today = (stats.today || 0) + 1;
  if (now - submission.timestamp < day * 7) stats.week = (stats.week || 0) + 1;
  if (now - submission.timestamp < day * 30) stats.month = (stats.month || 0) + 1;

  await env.FEEDBACK_KV.put('analytics:stats', JSON.stringify(stats), {
    expirationTtl: 7776000,
  });
}

async function sendToDiscord(env, submission) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const fields = [];

  if (submission.discord) {
    fields.push({
      name: 'Discord Username',
      value: submission.discord,
      inline: true,
    });
  }

  for (const answer of submission.answers) {
    if (!answer.value || (Array.isArray(answer.value) && answer.value.length === 0)) {
      continue;
    }
    fields.push({
      name: answer.label || answer.id,
      value: formatDiscordValue(answer),
      inline: ['rating', 'yesno', 'select', 'dropdown'].includes(answer.type),
    });
  }

  const embed = {
    embeds: [
      {
        title: 'New Feedback Submission',
        color: 0x5865f2,
        fields: fields,
        timestamp: new Date(submission.timestamp).toISOString(),
        footer: { text: 'Feedback System' },
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
  } catch {
    console.error('Failed to send Discord webhook');
  }
}

function formatDiscordValue(answer) {
  switch (answer.type) {
    case 'rating': {
      const num = Number(answer.value);
      if (isNaN(num)) return String(answer.value);
      const clamped = Math.max(1, Math.min(10, num));
      const stars = '\u2605'.repeat(Math.min(clamped, 5)) + '\u2606'.repeat(Math.max(0, 5 - Math.min(clamped, 5)));
      return `${stars} (${clamped})`;
    }
    case 'yesno':
      return answer.value;
    case 'checkboxes':
      if (Array.isArray(answer.value) && answer.value.length > 0) {
        return answer.value.map((v) => '\u2022 ' + v).join('\n');
      }
      return 'None selected';
    default:
      return String(answer.value);
  }
}

async function logSubmissionActivity(env, action, submissionId) {
  if (!env.FEEDBACK_KV) return;
  try {
    const id = generateId(16);
    const entry = {
      id,
      action,
      submissionId,
      timestamp: Date.now(),
    };
    await env.FEEDBACK_KV.put(`activity:${Date.now()}:${id}`, JSON.stringify(entry), {
      expirationTtl: 2592000,
    });
    const indexStr = await env.FEEDBACK_KV.get('activity:index');
    let index = [];
    if (indexStr) {
      try { index = JSON.parse(indexStr); } catch { index = []; }
    }
    index.unshift({ id, timestamp: Date.now(), action, submissionId });
    if (index.length > 1000) {
      index = index.slice(0, 1000);
    }
    await env.FEEDBACK_KV.put('activity:index', JSON.stringify(index), {
      expirationTtl: 2592000,
    });
  } catch {
  }
}

export async function handleGetSubmissions(request, env) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const archived = url.searchParams.get('archived');
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = (page - 1) * limit;

  const indexStr = await env.FEEDBACK_KV.get('submissions:index');
  if (!indexStr) {
    return jsonResponse({ submissions: [], total: 0, page, limit }, 200, env.CORS_ORIGIN);
  }

  let index;
  try { index = JSON.parse(indexStr); } catch { index = []; }

  let filtered = index;
  if (archived === 'true') {
    filtered = filtered.filter((s) => s.archived);
  } else if (archived === 'false' || !archived) {
    filtered = filtered.filter((s) => !s.archived);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    const searchPromises = filtered.slice(0, 200).map(async (entry) => {
      const subStr = await env.FEEDBACK_KV.get(`submission:${entry.id}`);
      if (!subStr) return null;
      try {
        const sub = JSON.parse(subStr);
        const matchesSearch = sub.answers.some(
          (a) =>
            String(a.value).toLowerCase().includes(searchLower) ||
            (a.label || '').toLowerCase().includes(searchLower)
        ) || (sub.discord || '').toLowerCase().includes(searchLower);
        return matchesSearch ? entry : null;
      } catch {
        return null;
      }
    });
    const results = await Promise.all(searchPromises);
    filtered = results.filter(Boolean);
  }

  const total = filtered.length;
  const pageEntries = filtered.slice(offset, offset + limit);

  const submissionPromises = pageEntries.map(async (entry) => {
    const subStr = await env.FEEDBACK_KV.get(`submission:${entry.id}`);
    if (!subStr) return null;
    try {
      const sub = JSON.parse(subStr);
      return {
        id: sub.id,
        discord: sub.discord || '',
        answers: sub.answers,
        timestamp: sub.timestamp,
        archived: sub.archived,
        hasNotes: !!sub.notes,
      };
    } catch {
      return null;
    }
  });

  const submissions = (await Promise.all(submissionPromises)).filter(Boolean);

  return jsonResponse({ submissions, total, page, limit }, 200, env.CORS_ORIGIN);
}

export async function handleGetSubmission(request, env, id) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const subStr = await env.FEEDBACK_KV.get(`submission:${id}`);
  if (!subStr) {
    return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);
  }

  let sub;
  try { sub = JSON.parse(subStr); } catch {
    return errorResponse('Failed to read submission.', 500, env.CORS_ORIGIN);
  }

  const safe = {
    id: sub.id,
    discord: sub.discord || '',
    answers: sub.answers,
    timestamp: sub.timestamp,
    archived: sub.archived,
    notes: sub.notes || '',
  };

  return jsonResponse(safe, 200, env.CORS_ORIGIN);
}

export async function handleArchiveSubmission(request, env, id) {
  return updateSubmissionField(env, id, 'archived', true);
}

export async function handleUnarchiveSubmission(request, env, id) {
  return updateSubmissionField(env, id, 'archived', false);
}

export async function handleDeleteSubmission(request, env, id) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const subStr = await env.FEEDBACK_KV.get(`submission:${id}`);
  if (!subStr) {
    return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);
  }

  await env.FEEDBACK_KV.delete(`submission:${id}`);

  const indexStr = await env.FEEDBACK_KV.get('submissions:index');
  if (indexStr) {
    let index = JSON.parse(indexStr);
    index = index.filter((s) => s.id !== id);
    await env.FEEDBACK_KV.put('submissions:index', JSON.stringify(index), {
      expirationTtl: 7776000,
    });
  }

  await logSubmissionActivity(env, 'submission_deleted', id);

  return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
}

export async function handleAddNotes(request, env, id) {
  try {
    const body = await request.json();
    const notes = sanitizeString(String(body.notes || ''), 5000);
    return updateSubmissionField(env, id, 'notes', notes);
  } catch {
    return errorResponse('Invalid request.', 400, env.CORS_ORIGIN);
  }
}

async function updateSubmissionField(env, id, field, value) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const subStr = await env.FEEDBACK_KV.get(`submission:${id}`);
  if (!subStr) {
    return errorResponse('Submission not found.', 404, env.CORS_ORIGIN);
  }

  let sub;
  try { sub = JSON.parse(subStr); } catch {
    return errorResponse('Failed to read submission.', 500, env.CORS_ORIGIN);
  }

  sub[field] = value;

  await env.FEEDBACK_KV.put(`submission:${id}`, JSON.stringify(sub), {
    expirationTtl: 7776000,
  });

  if (field === 'archived') {
    const indexStr = await env.FEEDBACK_KV.get('submissions:index');
    if (indexStr) {
      let index = JSON.parse(indexStr);
      const entry = index.find((s) => s.id === id);
      if (entry) {
        entry.archived = value;
        await env.FEEDBACK_KV.put('submissions:index', JSON.stringify(index), {
          expirationTtl: 7776000,
        });
      }
    }

    await logSubmissionActivity(
      env,
      value ? 'submission_archived' : 'submission_unarchived',
      id
    );
  }

  if (field === 'notes') {
    await logSubmissionActivity(env, 'notes_added', id);
  }

  return jsonResponse({ success: true }, 200, env.CORS_ORIGIN);
}

export async function handleGetAnalytics(request, env) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const statsStr = await env.FEEDBACK_KV.get('analytics:stats');
  const stats = statsStr ? JSON.parse(statsStr) : { total: 0, today: 0, week: 0, month: 0 };

  const indexStr = await env.FEEDBACK_KV.get('submissions:index');
  let index = [];
  if (indexStr) {
    try { index = JSON.parse(indexStr); } catch { index = []; }
  }

  const now = Date.now();
  const day = 86400000;
  const last7Days = [];
  const ratingDistribution = {};
  let totalRating = 0;
  let ratingCount = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(now - i * day);
    const label = date.toISOString().slice(0, 10);
    last7Days.unshift({ date: label, count: 0 });
  }

  const recentSubmissions = index.slice(0, 1000);

  for (const entry of recentSubmissions) {
    const subStr = await env.FEEDBACK_KV.get(`submission:${entry.id}`);
    if (!subStr) continue;
    try {
      const sub = JSON.parse(subStr);
      const subDate = new Date(sub.timestamp).toISOString().slice(0, 10);
      const dayEntry = last7Days.find((d) => d.date === subDate);
      if (dayEntry) dayEntry.count++;

      for (const answer of sub.answers) {
        if (answer.type === 'rating') {
          const rating = Number(answer.value);
          if (!isNaN(rating)) {
            totalRating += rating;
            ratingCount++;
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
          }
        }
      }
    } catch {}
  }

  const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;

  return jsonResponse(
    { stats, timeline: last7Days, ratingDistribution, averageRating, ratingCount },
    200,
    env.CORS_ORIGIN
  );
}

export async function handleExport(request, env) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'csv';
  const includeArchived = url.searchParams.get('archived') === 'true';

  const indexStr = await env.FEEDBACK_KV.get('submissions:index');
  if (!indexStr) {
    return errorResponse('No submissions found.', 404, env.CORS_ORIGIN);
  }

  let index;
  try { index = JSON.parse(indexStr); } catch { index = []; }

  if (!includeArchived) {
    index = index.filter((s) => !s.archived);
  }

  const submissions = [];
  for (const entry of index) {
    const subStr = await env.FEEDBACK_KV.get(`submission:${entry.id}`);
    if (subStr) {
      try {
        submissions.push(JSON.parse(subStr));
      } catch {}
    }
  }

  if (format === 'json') {
    const safe = submissions.map((s) => ({
      id: s.id,
      discord: s.discord || '',
      answers: s.answers,
      timestamp: s.timestamp,
      archived: s.archived,
    }));
    return jsonResponse(safe, 200, env.CORS_ORIGIN);
  }

  let csv = 'ID,Discord,Timestamp,Archived';
  const answerLabels = new Set();
  for (const sub of submissions) {
    for (const a of sub.answers) {
      answerLabels.add(a.label || a.id);
    }
  }
  const labelArray = Array.from(answerLabels);
  csv += ',' + labelArray.join(',') + '\n';

  for (const sub of submissions) {
    const row = [
      sub.id,
      sub.discord || '',
      new Date(sub.timestamp).toISOString(),
      sub.archived ? 'Yes' : 'No',
    ];
    for (const label of labelArray) {
      const answer = sub.answers.find((a) => (a.label || a.id) === label);
      if (answer) {
        const val = Array.isArray(answer.value) ? answer.value.join('; ') : String(answer.value);
        row.push('"' + val.replace(/"/g, '""') + '"');
      } else {
        row.push('');
      }
    }
    csv += row.join(',') + '\n';
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feedback-export.csv"',
    },
  });
}

export async function handleGetActivity(request, env) {
  if (!env.FEEDBACK_KV) {
    return errorResponse('Storage not configured.', 503, env.CORS_ORIGIN);
  }

  const indexStr = await env.FEEDBACK_KV.get('activity:index');
  if (!indexStr) {
    return jsonResponse({ activity: [] }, 200, env.CORS_ORIGIN);
  }

  let index;
  try { index = JSON.parse(indexStr); } catch { index = []; }

  const limit = Math.min(parseInt(request.url.split('limit=')[1]) || 100, 200);
  const recent = index.slice(0, limit);

  return jsonResponse({ activity: recent }, 200, env.CORS_ORIGIN);
}
