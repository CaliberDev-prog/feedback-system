# Spin Up a New Server (2 minutes)

Use this when you want a **brand-new, isolated** feedback system for another
Discord server or client. It creates a new Worker, new KV, new D1 database, and
new secrets — and never touches the existing deployment.

## What you need

- Cloudflare account logged in on this machine (run `npx wrangler login` once)
- The Discord webhook URL for the new server's feedback channel

## Steps

```powershell
git clone https://github.com/CaliberDev-prog/feedback-system.git feedback-system-igloo
cd feedback-system-igloo
npm install
npm run new
```

Answer the prompts:

1. **Instance name** — e.g. `calibers-igloo-feedback` (lowercase, hyphens). This
   becomes the Worker name, the D1 database name, and the URL.
2. **Site display name** — e.g. `Caliber's Igloo`.
3. **Accent color** — press Enter to keep the default.
4. **Admin password** — the dashboard login (username is always `admin`).
5. **Discord webhook URL** — paste the new server's webhook.
6. **Rebrand?** — press Enter to replace `Kwan's Performance Hub` with your new
   site name in the form and backend defaults.

The script then:

- creates a new KV namespace and a new D1 database
- backs up `wrangler.toml` and writes a fresh one (new Worker name, **no** custom
  domain)
- rebrands `public/config.js` and `worker/database/seed.js`
- deploys the new Worker
- sets `ADMIN_PASSWORD`, `DISCORD_WEBHOOK_URL`, and `SESSION_SECRET` secrets
- smoke-tests the new URL

When it finishes you'll see something like:

```
  Site      : https://calibers-igloo-feedback.caliber-feedback.workers.dev
  Admin     : https://calibers-igloo-feedback.caliber-feedback.workers.dev/admin/
```

## After it's live

1. Log in to `/admin/` with `admin` + the password you chose.
2. Submit a test form and confirm it lands in the new Discord channel.
3. To use your own domain (e.g. `feedback.calibersigloo.com`):
   Cloudflare dashboard → **Workers & Pages** → your Worker →
   **Settings → Triggers → Custom Domains**.
4. Fine-tune questions, colors, and text in `public/config.js`, then
   `npm run deploy`. Admin-facing settings can be edited in the dashboard.

## Safety notes

- The script **never** reuses Kwan's KV/D1/webhook/password. The existing
  deployment is untouched.
- Before overwriting `wrangler.toml`, the script saves a backup like
  `wrangler.toml.backup-20260731-120000`. To undo, copy it back over
  `wrangler.toml`.
- Preview without changing anything:

  ```powershell
  npm run new:preview
  ```

- If you push this folder to its **own** GitHub repo and push to `main`, the
  included GitHub Action (`.github/workflows/deploy.yml`) will auto-deploy.
  Set that repo's `CF_API_TOKEN`, `DISCORD_WEBHOOK_URL`, `ADMIN_PASSWORD`, and
  `SESSION_SECRET` secrets, or delete the workflow file.

## How the script works under the hood

| Step | Command |
| --- | --- |
| New KV | `npx wrangler kv namespace create <name>-kv` |
| New D1 | `npx wrangler d1 create <name>` |
| Deploy | `npm run deploy` |
| Secrets | `npx wrangler secret put ADMIN_PASSWORD` / `DISCORD_WEBHOOK_URL` / `SESSION_SECRET` |

The D1 tables are created automatically by the Worker on its first request
(`worker/database/migrate.js`), so no manual SQL step is needed.
