import { generateId, generateToken } from '../utils/crypto.js';
import { getClientIp } from '../utils/ip.js';

export async function createSession(env, admin, request) {
  const sessionId = generateId(48);
  const token = generateToken();
  const csrfToken = generateToken();
  const sessionTtl = parseInt(env.ADMIN_SESSION_TTL) || 86400;
  const now = Math.floor(Date.now() / 1000);

  const sessionData = {
    token,
    csrfToken,
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    ip: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || '',
    createdAt: now,
    expiresAt: now + sessionTtl,
    ipChanged: false,
  };

  if (env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: sessionTtl + 3600,
    });
  }

  return { sessionId, token, csrfToken, sessionData };
}

export async function validateSession(request, env) {
  const sessionId = getSessionFromCookie(request);
  if (!sessionId || !env.FEEDBACK_KV) return null;

  const sessionStr = await env.FEEDBACK_KV.get(`session:${sessionId}`);
  if (!sessionStr) return null;

  let session;
  try { session = JSON.parse(sessionStr); } catch { return null; }

  const now = Math.floor(Date.now() / 1000);
  if (now > session.expiresAt) {
    await env.FEEDBACK_KV.delete(`session:${sessionId}`);
    return null;
  }

  const token = getTokenFromCookie(request);
  if (session.token !== token) return null;

  const ip = getClientIp(request);
  if (session.ip && session.ip !== ip && !session.ipChanged) {
    session.ipChanged = true;
    session.ip = ip;
    const sTtl = parseInt(env.ADMIN_SESSION_TTL) || 86400;
    await env.FEEDBACK_KV.put(`session:${sessionId}`, JSON.stringify(session), {
      expirationTtl: sTtl + 3600,
    });
  }

  return session;
}

export async function destroySession(request, env) {
  const sessionId = getSessionFromCookie(request);
  if (sessionId && env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.delete(`session:${sessionId}`);
  }
}

export function setSessionCookies(response, sessionId, token, csrfToken, maxAge) {
  response.headers.append(
    'Set-Cookie',
    `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
  response.headers.append(
    'Set-Cookie',
    `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function setCsrfCookie(response, csrfToken, maxAge) {
  response.headers.append(
    'Set-Cookie',
    `csrf=${csrfToken}; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookies(response) {
  response.headers.append('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  response.headers.append('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  response.headers.append('Set-Cookie', 'csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0');
}

export function getCsrfToken(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
  return match ? match[1] : null;
}

function getSessionFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

function getTokenFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? match[1] : null;
}
