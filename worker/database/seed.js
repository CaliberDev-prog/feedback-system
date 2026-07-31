import { generateId, generatePasswordHash } from '../utils/crypto.js';

const DEFAULT_BRANDING = {
  title: "Kwan's Performance Hub Feedback",
  description: "Help us improve Kwan's Performance Hub by sharing your experience, reporting issues, or suggesting new ideas.",
  logo: 'assets/logo.svg',
  favicon: 'assets/favicon.svg',
  accentColor: '#5865F2',
  backgroundColor: '#0a0a0f',
  theme: 'dark',
  typography: 'system',
  borderRadius: 12,
  footer: '© Kwan\'s Performance Hub. All rights reserved.',
  openGraph: { title: '', description: '', image: '' },
  seo: { index: true, follow: true },
};

const DEFAULT_QUESTIONS = [
  { id: 'rating', type: 'rating', label: "How would you rate your overall experience in Kwan's Performance Hub?", required: true, min: 1, max: 5 },
  { id: 'category', type: 'select', label: 'What is your feedback about?', required: true, options: ['Community', 'Staff Team', 'Support', 'Products & Services', 'Events', 'Suggestions', 'Bug Report', 'Other'] },
  { id: 'subject', type: 'text', label: 'Subject', required: true, placeholder: 'Brief summary of your feedback', maxLength: 150 },
  { id: 'message', type: 'textarea', label: 'Tell us more', required: true, placeholder: 'Please provide as much detail as possible so we can better understand your feedback.', maxLength: 2500 },
  { id: 'improvements', type: 'checkboxes', label: 'What areas could we improve?', required: false, options: ['Server Organization', 'Support Response Time', 'Staff Availability', 'Community Engagement', 'Giveaways', 'Events', 'Information & Guides', 'Communication', 'Products & Services'] },
  { id: 'recommend', type: 'yesno', label: 'Would you recommend Kwan\'s Performance Hub to others?', required: true },
  { id: 'followup', type: 'yesno', label: 'Would you like a staff member to follow up with you regarding this feedback?', required: false },
];

const DEFAULT_DISCORD = {
  enabled: true,
  webhookUrl: '',
  embedTitle: 'New Feedback Submission',
  embedColor: '#5865F2',
  embedFooter: 'Feedback System',
  showTimestamp: true,
  showDiscordField: true,
  discordLabel: 'Discord Username (optional)',
  discordPlaceholder: 'Your Discord username',
};

const DEFAULT_SETTINGS = {
  rateLimitMax: 20,
  rateLimitWindow: 60,
  sessionTtl: 86400,
  maxExportSize: 10000,
  maintenanceMode: false,
  formOpen: true,
  autoArchiveDays: 0,
  retentionDays: 0,
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  language: 'en',
};

export async function seedDefaults(env) {
  if (!env.DB) return;

  const configs = [
    ['branding', DEFAULT_BRANDING],
    ['questions', DEFAULT_QUESTIONS],
    ['discord', DEFAULT_DISCORD],
    ['settings', DEFAULT_SETTINGS],
  ];

  for (const [key, defaults] of configs) {
    const existing = await env.DB.prepare('SELECT key FROM config WHERE key = ?').bind(key).first();
    if (!existing) {
      const str = JSON.stringify(defaults);
      await env.DB.prepare(
        "INSERT INTO config (key, live_value, draft_value) VALUES (?, ?, ?)"
      ).bind(key, str, str).run();
    }
  }

  const adminExists = await env.DB.prepare('SELECT id FROM admins LIMIT 1').first();
  if (!adminExists && env.ADMIN_PASSWORD) {
    const id = generateId(16);
    const hash = await generatePasswordHash(env.ADMIN_PASSWORD);
    await env.DB.prepare(
      'INSERT INTO admins (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, 'admin', hash, 'Admin', 'owner').run();
  }

  const perms = [
    ['owner', 'submission.view'], ['owner', 'submission.delete'], ['owner', 'submission.export'],
    ['owner', 'analytics.view'], ['owner', 'settings.manage'], ['owner', 'audit.view'], ['owner', 'admin.manage'],
    ['admin', 'submission.view'], ['admin', 'submission.delete'], ['admin', 'submission.export'],
    ['admin', 'analytics.view'], ['admin', 'audit.view'], ['admin', 'settings.manage'],
    ['moderator', 'submission.view'], ['moderator', 'analytics.view'],
    ['viewer', 'submission.view'], ['viewer', 'analytics.view'],
  ];
  for (const [role, permission] of perms) {
    const existing = await env.DB.prepare(
      'SELECT id FROM permissions WHERE role = ? AND permission = ?'
    ).bind(role, permission).first();
    if (existing) continue;
    const pid = generateId(8);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO permissions (id, role, permission) VALUES (?, ?, ?)'
    ).bind(pid, role, permission).run();
  }
}
