# Installation Guide

## Prerequisites

Before you begin, make sure you have the following:

- **Node.js** (version 18 or later): Download from https://nodejs.org
- **npm**: Included with Node.js
- **Git**: Download from https://git-scm.com
- **A Cloudflare account**: Sign up at https://dash.cloudflare.com/sign-up
- **Wrangler CLI**: Install with `npm install -g wrangler`

## Step 1: Clone or Download the Repository

```bash
git clone https://github.com/your-username/feedback-system.git
cd feedback-system
```

If you are not using Git, download the ZIP file and extract it.

## Step 2: Install Dependencies

```bash
npm install
```

This installs `wrangler` and other development dependencies.

## Step 3: Configure the Project

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and fill in your configuration values:

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
- `ADMIN_PASSWORD`: A strong password for the admin dashboard
- `SESSION_SECRET`: A random 64-character string

See the Configuration Guide for detailed instructions.

## Step 4: Configure Cloudflare

### Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### Create a KV Namespace

```bash
wrangler kv:namespace create FEEDBACK_KV
```

Copy the output ID and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FEEDBACK_KV"
id = "your-namespace-id"
preview_id = "your-preview-id"
```

### Set Secrets

```bash
echo "your-webhook-url" | wrangler secret put DISCORD_WEBHOOK_URL
echo "your-admin-password" | wrangler secret put ADMIN_PASSWORD
echo "your-session-secret" | wrangler secret put SESSION_SECRET
```

## Step 5: Deploy

```bash
npm run deploy
```

This deploys the Worker and serves the static files from the `public` directory.

## Step 6: Verify

Visit your Worker URL (shown after deployment) to see the feedback form.

Visit `https://your-worker.workers.dev/admin/` to access the admin dashboard.

Log in using the password you set in `ADMIN_PASSWORD`.

## Troubleshooting

If you encounter issues, see the Troubleshooting Guide.
