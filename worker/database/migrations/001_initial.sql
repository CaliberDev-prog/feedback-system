CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  discord TEXT DEFAULT '',
  timestamp INTEGER NOT NULL,
  archived INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS submission_answers (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_answers_submission ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON submission_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp);
CREATE INDEX IF NOT EXISTS idx_submissions_archived ON submissions(archived);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT,
  last_ip TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  UNIQUE(role, permission)
);
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  admin_id TEXT,
  admin_username TEXT DEFAULT '',
  submission_id TEXT,
  details TEXT DEFAULT '{}',
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS export_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  format TEXT NOT NULL,
  filters TEXT DEFAULT '{}',
  count INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL
);
