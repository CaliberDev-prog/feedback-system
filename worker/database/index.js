import { generateId, generatePasswordHash } from '../utils/crypto.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, discord TEXT DEFAULT '', timestamp INTEGER NOT NULL,
  archived INTEGER DEFAULT 0, notes TEXT DEFAULT '', ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS submission_answers (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, question_id TEXT NOT NULL,
  question_type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', value TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_answers_submission ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON submission_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp);
CREATE INDEX IF NOT EXISTS idx_submissions_archived ON submissions(archived);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '', role TEXT NOT NULL DEFAULT 'admin',
  enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT, last_ip TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, permission TEXT NOT NULL, UNIQUE(role, permission)
);
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, action TEXT NOT NULL,
  admin_id TEXT, admin_username TEXT DEFAULT '', submission_id TEXT,
  details TEXT DEFAULT '{}', ip TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now'))
);
`;

export async function initializeDatabase(env) {
  if (!env.DB) return;
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try { await env.DB.exec(stmt.trim() + ';'); } catch {}
  }
  await seedDefaults(env);
}

async function seedDefaults(env) {
  if (!env.ADMIN_PASSWORD) return;
  const existing = await env.DB.prepare('SELECT id FROM admins LIMIT 1').first();
  if (existing) return;

  const id = generateId(16);
  const hash = await generatePasswordHash(env.ADMIN_PASSWORD);

  await env.DB.prepare(
    'INSERT INTO admins (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, 'admin', hash, 'Admin', 'owner').run();

  const rolePerms = [
    ['owner', 'submission.view'],
    ['owner', 'submission.delete'],
    ['owner', 'submission.export'],
    ['owner', 'analytics.view'],
    ['owner', 'settings.manage'],
    ['owner', 'audit.view'],
    ['owner', 'admin.manage'],
    ['admin', 'submission.view'],
    ['admin', 'submission.delete'],
    ['admin', 'submission.export'],
    ['admin', 'analytics.view'],
    ['admin', 'audit.view'],
    ['admin', 'settings.manage'],
    ['moderator', 'submission.view'],
    ['moderator', 'analytics.view'],
    ['viewer', 'submission.view'],
    ['viewer', 'analytics.view'],
  ];
  for (const [role, permission] of rolePerms) {
    const pid = generateId(8);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO permissions (id, role, permission) VALUES (?, ?, ?)'
    ).bind(pid, role, permission).run();
  }
}
