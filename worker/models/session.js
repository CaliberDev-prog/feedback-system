import { generateId, generateToken } from '../utils/crypto.js';
import { getClientIp } from '../utils/ip.js';

export async function createSession(env, admin, request) {
  const sessionId = generateId(48);
  const token = generateToken();
  const sessionTtl = parseInt(env.ADMIN_SESSION_TTL) || 86400;
  const now = Math.floor(Date.now() / 1000);

  const sessionData = {
    token,
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    ip: getClientIp(request),
    userAgent: request.headers.get('User-Agent') || '',
    createdAt: now,
    expiresAt: now + sessionTtl,
  };

  if (env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: sessionTtl + 3600,
    });
  }

  return { sessionId, token, sessionData };
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
  if (session.ip !== ip) return null;

  return session;
}

export async function destroySession(request, env) {
  const sessionId = getSessionFromCookie(request);
  if (sessionId && env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.delete(`session:${sessionId}`);
  }
}

export function setSessionCookies(response, sessionId, token, maxAge) {
  response.headers.append(
    'Set-Cookie',
    `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
  response.headers.append(
    'Set-Cookie',
    `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookies(response) {
  response.headers.append('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  response.headers.append('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
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
