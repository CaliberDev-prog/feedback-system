# Security Guide

## Overview

The Universal Feedback System follows security best practices to protect your data and your users. This document outlines the security measures implemented in the system.

## Authentication

### Admin Dashboard

- Password is stored as a Cloudflare Worker Secret, never in the codebase
- Password comparison uses timing-safe comparison to prevent timing attacks
- Sessions use cryptographically secure random tokens
- Session tokens are stored in HttpOnly, Secure, SameSite cookies
- Sessions expire after a configurable TTL (default: 24 hours)
- Session data is stored in Cloudflare KV with server-side validation
- Session tokens are rotated on each login
- IP address is validated as part of the session to prevent hijacking

### Rate Limiting

- All API endpoints are rate limited
- Rate limits are tracked per IP address
- Default: 20 requests per minute
- Rate limit violations return a 429 status with a Retry-After header
- Admin login has additional brute force protection

## Data Protection

### Secrets Management

Secrets are stored exclusively as Cloudflare Worker Secrets:
- Admin password
- Discord webhook URL
- Session signing key
- Never stored in the repository, environment files, or frontend code

### Input Validation

All user input is validated and sanitized server-side:
- String length limits enforced
- HTML tags stripped
- Control characters removed
- Discord usernames validated against pattern
- Rating values clamped to valid range
- Select/dropdown values checked against allowed options
- Checkbox values validated against allowed options

## HTTP Security

### Headers

Every response includes security headers:

- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 0` - Modern XSS protection via CSP
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` - Restricts browser features
- `Content-Security-Policy` - Restricts resource loading
- `Strict-Transport-Security` - Enforces HTTPS

### Cookies

Cookies use these attributes:
- `HttpOnly` - Inaccessible to JavaScript
- `Secure` - Only sent over HTTPS
- `SameSite=Strict` - Not sent with cross-site requests

### CORS

Configurable CORS origin. By default, only same-origin requests are allowed.

## CSRF Protection

- Session-based authentication with token validation
- Cookies set with SameSite=Strict prevent CSRF from external sites
- State-changing requests require authentication cookies

## XSS Prevention

- Content Security Policy restricts script execution
- All user-supplied data is sanitized before rendering
- Template literals sanitized through textContent
- Worker responses sanitize all stored data

## Best Practices

### For Administrators

1. Use a strong, unique admin password
2. Change the admin password regularly
3. Use a unique session secret (64+ characters)
4. Monitor the activity log for suspicious activity
5. Keep dependencies updated
6. Review submissions periodically for abuse

### For Developers

1. Never commit secrets to the repository
2. Use environment variables for all configuration
3. Validate all input server-side
4. Sanitize all output before rendering
5. Use the principle of least privilege
6. Review code changes for security implications

## Incident Response

If you suspect a security breach:

1. Rotate all secrets (admin password, webhook URL, session secret)
2. Review the activity log for unauthorized access
3. Delete any compromised sessions from KV
4. Consider redeploying the Worker
5. Change your Discord webhook URL

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately by opening a security advisory on GitHub or contacting the repository maintainer directly.
