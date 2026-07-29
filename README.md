# Universal Feedback System

A modern, professional feedback system that can be deployed for any Discord server, business, community, project, or organization with minimal setup.

## Features

- **Dynamic Form Builder** - 7 question types generated from configuration
- **Discord Integration** - Submissions sent as formatted embeds
- **Secure Admin Dashboard** - View, search, filter, archive, delete, and manage submissions
- **Analytics** - Submission statistics, rating distributions, and timeline charts
- **CSV Export** - Download your data anytime
- **Activity Log** - Track all administrative actions
- **Rate Limiting** - Built-in spam and abuse protection
- **Responsive Design** - Works on phones, tablets, and desktops
- **Accessibility** - Keyboard navigation and screen reader support
- **Security** - CSP, HttpOnly cookies, timing-safe auth, input sanitization

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account (free)
- Discord server with webhook permissions

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/feedback-system.git
cd feedback-system

# Install dependencies
npm install

# Log in to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create FEEDBACK_KV

# Set secrets
wrangler secret put DISCORD_WEBHOOK_URL
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET

# Deploy
npm run deploy
```

### Configure

Edit `public/config.js` to customize:
- Branding, logo, colors, and footer
- Form questions and field types
- Success messages and redirects

## Documentation

- [Installation Guide](docs/INSTALL.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Security Guide](docs/SECURITY.md)
- [FAQ](docs/FAQ.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Contributing](docs/CONTRIBUTING.md)

## Project Structure

```
feedback-system/
  public/             Frontend files
    admin/            Admin dashboard
    css/              Stylesheets
    js/               JavaScript modules
    assets/           Logos and icons
  worker/             Cloudflare Worker backend
  docs/               Documentation
  wrangler.toml       Worker configuration
  package.json        Dependencies
```

## License

MIT
