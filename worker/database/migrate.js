const MIGRATIONS = [
  {
    name: '001_initial.sql',
    sql: `CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT DEFAULT (datetime('now'))
);
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
CREATE TABLE IF NOT EXISTS export_log (
  id TEXT PRIMARY KEY, admin_id TEXT, format TEXT NOT NULL,
  filters TEXT DEFAULT '{}', count INTEGER DEFAULT 0, timestamp INTEGER NOT NULL
);`,
  },
  {
    name: '002_config_and_versions.sql',
    sql: `CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  live_value TEXT NOT NULL DEFAULT '{}',
  draft_value TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now')),
  published_at TEXT,
  published_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS config_versions (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL,
  value TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  admin_id TEXT,
  admin_username TEXT DEFAULT '',
  action TEXT DEFAULT 'publish'
);
CREATE TABLE IF NOT EXISTS config_backups (
  id TEXT PRIMARY KEY,
  label TEXT DEFAULT '',
  data TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  admin_id TEXT,
  admin_username TEXT DEFAULT ''
);`,
  },
];

export async function runMigrations(env) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch (e) {
    console.error('Ensure _migrations table:', e);
  }

  for (const migration of MIGRATIONS) {
    try {
      const row = await env.DB.prepare(
        'SELECT id FROM _migrations WHERE name = ?'
      ).bind(migration.name).first();
      if (row) continue;
    } catch {}

    const statements = migration.sql.split(';').filter(s => s.trim());
    try {
      if (env.DB.batch) {
        await env.DB.batch(statements.map(s => env.DB.prepare(s.trim())));
      } else {
        for (const s of statements) await env.DB.prepare(s.trim()).run();
      }
      await env.DB.prepare(
        'INSERT OR IGNORE INTO _migrations (name) VALUES (?)'
      ).bind(migration.name).run();
    } catch (e) {
      console.error(`Migration ${migration.name} failed:`, e);
    }
  }
}
