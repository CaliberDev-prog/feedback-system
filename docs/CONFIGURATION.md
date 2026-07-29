# Configuration Guide

## Overview

The system is configured through two places:

1. **`public/config.js`** - Frontend configuration (branding, questions, display settings)
2. **Cloudflare Worker Secrets** - Sensitive configuration (passwords, webhooks, keys)

## Frontend Configuration

Open `public/config.js` and edit the `FEEDBACK_CONFIG` object.

### Site Settings

```js
site: {
  title: 'Feedback',                    // Browser tab title
  description: 'We value your input.',  // Subtitle shown on the form
  logo: 'assets/logo.svg',             // Path to your logo
  favicon: 'assets/favicon.svg',       // Path to your favicon
  accentColor: '#5865F2',              // Primary color (hex)
  theme: 'light',                      // Color theme
  footer: 'Powered by Feedback System' // Footer text
}
```

### Form Settings

```js
form: {
  endpoint: '/api/submit',             // API endpoint for submissions
  successMessage: 'Thank you!',        // Success message after submission
  errorMessage: 'Something went wrong.', // Error message on failure
  submitButtonText: 'Submit Feedback',  // Submit button text
  showDiscordField: true,              // Show optional Discord username field
  discordLabel: 'Discord Username',    // Label for Discord field
  discordPlaceholder: 'Username#0000'  // Placeholder text
}
```

### Success Page Settings

```js
success: {
  title: 'Feedback Submitted',
  message: 'Your feedback has been received.',
  showNewButton: true,
  newButtonText: 'Submit Another Response',
  redirectUrl: '',                     // Redirect URL (leave empty to stay)
  redirectDelay: 0                     // Delay in ms before redirect
}
```

### Questions

The `questions` array defines your form fields. Each question has these common properties:

- `id` (string, required): Unique identifier
- `type` (string, required): Field type
- `label` (string, required): Display label
- `required` (boolean): Whether the field is mandatory

### Question Types

#### Rating

```js
{
  id: 'satisfaction',
  type: 'rating',
  label: 'How satisfied are you?',
  required: true,
  min: 1,
  max: 5
}
```

#### Short Text

```js
{
  id: 'subject',
  type: 'text',
  label: 'Subject',
  required: true,
  placeholder: 'Enter a subject',
  maxLength: 200
}
```

#### Paragraph

```js
{
  id: 'details',
  type: 'textarea',
  label: 'Details',
  required: true,
  placeholder: 'Tell us more...',
  maxLength: 2000
}
```

#### Multiple Choice

```js
{
  id: 'category',
  type: 'select',
  label: 'Category',
  required: true,
  options: ['Bug', 'Feature', 'General']
}
```

#### Dropdown

```js
{
  id: 'priority',
  type: 'dropdown',
  label: 'Priority',
  required: false,
  options: ['Low', 'Medium', 'High']
}
```

#### Checkboxes

```js
{
  id: 'topics',
  type: 'checkboxes',
  label: 'Topics',
  required: false,
  options: ['UI', 'Performance', 'Security']
}
```

#### Yes/No

```js
{
  id: 'recommend',
  type: 'yesno',
  label: 'Would you recommend us?',
  required: true
}
```

## Worker Secrets

Set these using `wrangler secret put`:

```bash
wrangler secret put DISCORD_WEBHOOK_URL
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
```

### Discord Webhook

1. Open your Discord server settings
2. Go to Integrations > Webhooks
3. Create a new webhook
4. Copy the webhook URL
5. Set it as `DISCORD_WEBHOOK_URL`

## Custom Domain

Point a custom domain to your Worker for a professional URL.

1. Go to Cloudflare Dashboard
2. Select your Worker
3. Go to Triggers > Custom Domains
4. Add your domain
