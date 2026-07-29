# Frequently Asked Questions

## General

### What is the Universal Feedback System?

A ready-to-deploy feedback platform that works with any Discord server, business, or organization. It collects user feedback through a customizable form and sends it to a Discord channel via webhooks. It includes an admin dashboard for managing submissions.

### Do I need coding experience?

Basic familiarity with the command line and Git is helpful, but the system is designed to be set up by editing a single configuration file and running a few commands.

### Can I use it for free?

Yes. The system runs on Cloudflare's free tier and GitHub Pages. The free tier should handle most small to medium traffic levels.

## Setup

### What do I need to get started?

- A Cloudflare account (free)
- A Discord server where you can create webhooks
- Node.js installed on your computer
- Basic familiarity with the terminal

### How long does setup take?

If you have all prerequisites ready, setup takes approximately 15-30 minutes.

### Can I use a custom domain?

Yes. You can point a custom domain to your Cloudflare Worker through the Cloudflare dashboard.

## Configuration

### How do I change the form questions?

Edit the `questions` array in `public/config.js`. See the Configuration Guide for details on each question type.

### Can I have multiple forms?

Currently the system supports one form per deployment. For multiple forms, you can deploy multiple instances or wait for the multi-form feature in a future release.

### How do I change the accent color?

Set the `accentColor` property in `public/config.js`. Use a hex color value (e.g., `#8B5CF6`).

## Discord Integration

### How do I create a Discord webhook?

1. Open your Discord server settings
2. Go to Integrations > Webhooks
3. Click "Create Webhook"
4. Name it and select the channel
5. Copy the webhook URL

### What does a submission look like in Discord?

Each submission appears as a clean embed with all question answers, a timestamp, and an optional Discord username.

### Can I customize the Discord embed?

The embed title and footer can be customized in the Worker code. Field formatting adapts automatically to your configured questions.

## Admin Dashboard

### How do I access the admin dashboard?

Visit `/admin/` on your Worker URL. Log in with the password you set as `ADMIN_PASSWORD`.

### How do I recover a forgotten password?

Reset it by running:
```bash
wrangler secret put ADMIN_PASSWORD
```

### Can I export submissions?

Yes. Click the "Export" button on the Submissions page to download a CSV file.

## Troubleshooting

### The form shows an error when I submit

Check the browser console for errors. Verify your Worker is deployed and the endpoint URL in `config.js` is correct.

### The admin dashboard won't load

Make sure you're accessing it through the Worker URL, not the GitHub Pages URL. The admin panel requires server-side authentication.

### Submissions aren't appearing in Discord

Verify your Discord webhook URL is correct by running:
```bash
wrangler secret list
```

Check the Worker logs in the Cloudflare dashboard for errors.

## Technical

### What technologies are used?

- Frontend: HTML5, Tailwind CSS, Vanilla JavaScript
- Backend: Cloudflare Workers
- Storage: Cloudflare KV
- Notifications: Discord Webhooks

### Can I add new question types?

The system supports: rating, short text, paragraph, multiple choice, dropdown, checkboxes, and yes/no. Additional types can be added by extending the form renderer and validation logic.

### Is there a database?

The system uses Cloudflare KV for storage, which is a key-value store. Support for Cloudflare D1 (SQL database) may be added in a future release for more complex queries.
