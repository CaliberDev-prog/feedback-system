# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

## Reporting a Vulnerability

Report vulnerabilities to caliberdev50@gmail.com. Do not open public issues.

## Security Architecture

- Passwords hashed with SHA-256 + pepper before storage
- Sessions use HttpOnly/Secure/SameSite cookies with IP validation
- Rate limiting: 20 requests/min per IP on all API endpoints
- Input sanitization strips HTML tags and control characters
- CSP, X-Frame-Options, X-Content-Type-Options headers on all responses
- Role-based access control (owner, admin, moderator, viewer)
- Activity logging for all administrative actions
- D1 database for persistent data, KV for ephemeral sessions only
