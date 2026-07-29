# Troubleshooting Guide

## Common Issues

### Wrangler Login Fails

**Problem**: `wrangler login` does not open a browser or authentication fails.

**Solutions**:
- Ensure you are logged into your Cloudflare account in your default browser
- Try running `wrangler login --headless` and manually copying the token
- Check your internet connection
- Update wrangler: `npm install -g wrangler@latest`

### Deployment Fails

**Problem**: `npm run deploy` returns an error.

**Check these common causes**:
- You are not logged in (run `wrangler login`)
- The KV namespace ID is missing or incorrect in `wrangler.toml`
- Secrets are not set (run the `wrangler secret put` commands)
- Your Worker script exceeds the 1MB size limit

**Error: "Missing binding"**

Make sure you have created the KV namespace and added the ID to `wrangler.toml`:

```bash
wrangler kv:namespace create FEEDBACK_KV
```

Copy the returned ID into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FEEDBACK_KV"
id = "your-id-here"
```

### Form Submission Returns 500 Error

**Check the following**:
- Webhook URL is correct (`wrangler secret list` to verify)
- Worker is deployed and running
- Check Worker logs in Cloudflare Dashboard

**To check Worker logs**:

1. Go to Cloudflare Dashboard
2. Click on Workers & Pages
3. Select your Worker
4. Click on "Logs" tab
5. Look for error messages

### Admin Login Fails

**Problem**: Cannot log into the admin dashboard.

**Solutions**:
- Verify the admin password is set correctly: `wrangler secret put ADMIN_PASSWORD`
- Ensure you are accessing the admin page from the Worker domain, not GitHub Pages
- Clear your browser cookies for the site
- Try in an incognito/private browser window

### CORS Errors in Browser Console

**Problem**: See CORS errors when submitting form from GitHub Pages.

**Solution**: Set the `CORS_ORIGIN` variable in `wrangler.toml` to your GitHub Pages URL:

```toml
[vars]
CORS_ORIGIN = "https://your-username.github.io"
```

Then redeploy: `npm run deploy`

### Discord Embeds Not Showing

**Problem**: Submissions go through but nothing appears in Discord.

**Solutions**:
- Verify the webhook URL is correct
- Check that the webhook has permission to send messages in the target channel
- Check if the Discord API is rate limiting your webhook

### Rate Limiting

**Problem**: Users see "Too many requests" errors.

**Solutions**:
- Increase the rate limit in `wrangler.toml`:
  ```toml
  [vars]
  RATE_LIMIT_MAX = "100"
  RATE_LIMIT_WINDOW = "60"
  ```
- Check if a specific IP is abusing the form

### Static Files Not Loading

**Problem**: CSS, JS, or images are not loading.

**Solutions**:
- Verify the `public` directory is correctly configured in `wrangler.toml`
- Check file paths in HTML files (use relative paths from the `public` directory)
- Clear your browser cache
- Check the browser console for 404 errors

### Session Expires Too Quickly

**Problem**: Admin sessions expire too soon.

**Solution**: Increase the session TTL in `wrangler.toml`:

```toml
[vars]
ADMIN_SESSION_TTL = "172800"  # 48 hours
```

## Getting Help

If you cannot resolve your issue:

1. Check the FAQ for common questions
2. Search existing GitHub issues
3. Open a new GitHub issue with:
   - A clear description of the problem
   - Steps to reproduce
   - Error messages (if any)
   - Your configuration (with secrets removed)
