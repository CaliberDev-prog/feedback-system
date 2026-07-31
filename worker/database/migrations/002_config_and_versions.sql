CREATE TABLE IF NOT EXISTS config (
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
);
