import { generateId } from '../utils/crypto.js';

const CONFIG_KEYS = ['branding', 'questions', 'discord', 'settings'];

export async function getConfig(env, key, live = true) {
  const row = await env.DB.prepare(
    'SELECT live_value, draft_value FROM config WHERE key = ?'
  ).bind(key).first();
  if (!row) return {};
  const val = live ? row.live_value : row.draft_value;
  try { return JSON.parse(val); } catch { return {}; }
}

export async function getAllConfig(env, live = true) {
  const rows = await env.DB.prepare('SELECT key, live_value, draft_value FROM config').all();
  const result = {};
  for (const key of CONFIG_KEYS) {
    const row = rows.results.find(r => r.key === key);
    if (row) {
      try { result[key] = JSON.parse(live ? row.live_value : row.draft_value); } catch { result[key] = {}; }
    } else {
      result[key] = {};
    }
  }
  return result;
}

export async function setConfigDraft(env, key, value, adminId, adminUsername) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const existing = await env.DB.prepare('SELECT key FROM config WHERE key = ?').bind(key).first();
  if (existing) {
    await env.DB.prepare(
      "UPDATE config SET draft_value = ?, updated_at = datetime('now') WHERE key = ?"
    ).bind(str, key).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO config (key, live_value, draft_value) VALUES (?, '{}', ?)"
    ).bind(key, str).run();
  }
  return true;
}

export async function publishConfig(env, key, adminId, adminUsername) {
  const row = await env.DB.prepare(
    'SELECT draft_value, live_value FROM config WHERE key = ?'
  ).bind(key).first();
  if (!row) return false;

  const draft = row.draft_value;
  const oldLive = row.live_value;

  if (draft === oldLive) return false;

  await env.DB.prepare(
    "UPDATE config SET live_value = draft_value, published_at = datetime('now'), published_by = ? WHERE key = ?"
  ).bind(adminUsername || adminId || '', key).run();

  const version = await getNextVersion(env, key);
  await env.DB.prepare(
    'INSERT INTO config_versions (id, config_key, value, version, admin_id, admin_username, action) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(generateId(16), key, draft, version, adminId || '', adminUsername || '', 'publish').run();

  return true;
}

export async function publishAllConfig(env, adminId, adminUsername) {
  for (const key of CONFIG_KEYS) {
    await publishConfig(env, key, adminId, adminUsername);
  }
  return true;
}

export async function discardDraft(env, key) {
  const row = await env.DB.prepare(
    'SELECT live_value FROM config WHERE key = ?'
  ).bind(key).first();
  if (!row) return false;
  await env.DB.prepare(
    "UPDATE config SET draft_value = live_value, updated_at = datetime('now') WHERE key = ?"
  ).bind(key).run();
  return true;
}

export async function getConfigVersions(env, key, limit = 20) {
  const rows = await env.DB.prepare(
    'SELECT id, config_key, version, created_at, admin_username, action FROM config_versions WHERE config_key = ? ORDER BY version DESC LIMIT ?'
  ).bind(key, Math.min(limit, 100)).all();
  return rows.results;
}

export async function restoreVersion(env, versionId, adminId, adminUsername) {
  const row = await env.DB.prepare(
    'SELECT config_key, value FROM config_versions WHERE id = ?'
  ).bind(versionId).first();
  if (!row) return false;
  await env.DB.prepare(
    "UPDATE config SET draft_value = ? WHERE key = ?"
  ).bind(row.value, row.config_key).run();
  return true;
}

export async function getPublicConfig(env) {
  const rows = await env.DB.prepare('SELECT key, live_value FROM config').all();
  const result = {};
  for (const key of CONFIG_KEYS) {
    const row = rows.results.find(r => r.key === key);
    if (row) {
      try { result[key] = JSON.parse(row.live_value); } catch { result[key] = {}; }
    }
  }
  return result;
}

async function getNextVersion(env, key) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(version), 0) as mv FROM config_versions WHERE config_key = ?'
  ).bind(key).first();
  return (row?.mv || 0) + 1;
}

export { CONFIG_KEYS };
