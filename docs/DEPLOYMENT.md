# Deployment Guide

## Option 1: Cloudflare Workers (Recommended)

Deploy the entire system on Cloudflare Workers.

### Deploy

```bash
npm run deploy
```

This serves both the frontend and API from the same domain. No CORS configuration is needed.

### Custom Domain

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your Worker
3. Go to Triggers > Custom Domains
4. Add your domain

### Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`.

## Option 2: GitHub Pages + Cloudflare Worker

Host the frontend on GitHub Pages and the API on Cloudflare Workers.

### Deploy the Frontend to GitHub Pages

1. Push the `public` folder to a GitHub repository
2. Go to Settings > Pages
3. Select the branch and folder (e.g., `main` / `/public`)
4. Save and wait for deployment

### Deploy the Worker

Follow the Cloudflare Workers deployment steps above.

### Configure CORS

In `wrangler.toml`, set:

```toml
[vars]
CORS_ORIGIN = "https://your-username.github.io"
```

Update the API endpoint in `public/config.js`:

```js
form: {
  endpoint: "https://your-worker.workers.dev/api/submit",
  ...
}
```

## Option 3: Cloudflare Pages

Cloudflare Pages offers a simpler alternative to Workers for serving static files.

1. Fork the repository
2. Connect it to Cloudflare Pages
3. Set build output to `public`
4. Deploy

For API routes, you can add a `functions` directory that Cloudflare Pages will treat as Workers.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Yes | Discord webhook URL for notifications |
| `ADMIN_PASSWORD` | Yes | Password for the admin dashboard |
| `SESSION_SECRET` | Yes | Secret key for signing sessions |
| `RATE_LIMIT_MAX` | No | Maximum requests per window (default: 20) |
| `RATE_LIMIT_WINDOW` | No | Rate limit window in seconds (default: 60) |
| `CORS_ORIGIN` | No | Allowed origin for CORS (default: none) |
| `ADMIN_SESSION_TTL` | No | Session TTL in seconds (default: 86400) |
