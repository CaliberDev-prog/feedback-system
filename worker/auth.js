import { generateId, generateToken, timingSafeEqual, getClientIp, jsonResponse, errorResponse } from './utils.js';

export async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return errorResponse('Password is required.', 400, env.CORS_ORIGIN);
    }

    const storedPassword = env.ADMIN_PASSWORD;
    if (!storedPassword) {
      return errorResponse('Server configuration error.', 500, env.CORS_ORIGIN);
    }

    if (!timingSafeEqual(password, storedPassword)) {
      await logActivity(env, 'login_failed', { reason: 'invalid_password' });
      return errorResponse('Invalid password.', 401, env.CORS_ORIGIN);
    }

    const sessionId = generateId(48);
    const token = generateToken();
    const sessionTtl = parseInt(env.ADMIN_SESSION_TTL) || 86400;
    const now = Math.floor(Date.now() / 1000);

    const sessionData = {
      token: token,
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

    const responseData = {
      session: sessionId,
      token: token,
      expiresAt: sessionData.expiresAt,
    };

    await logActivity(env, 'login_success', {});

    const response = jsonResponse(responseData, 200, env.CORS_ORIGIN);

    response.headers.append(
      'Set-Cookie',
      `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${sessionTtl}`
    );
    response.headers.append(
      'Set-Cookie',
      `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${sessionTtl}`
    );

    return response;
  } catch (err) {
    return errorResponse('Invalid request.', 400, env.CORS_ORIGIN);
  }
}

export async function handleLogout(request, env) {
  const sessionId = getSessionFromCookie(request);
  if (sessionId && env.FEEDBACK_KV) {
    await env.FEEDBACK_KV.delete(`session:${sessionId}`);
  }

  const response = jsonResponse({ success: true }, 200, env.CORS_ORIGIN);

  response.headers.append(
    'Set-Cookie',
    'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );
  response.headers.append(
    'Set-Cookie',
    'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );

  await logActivity(env, 'logout', {});

  return response;
}

export async function validateSession(request, env) {
  const sessionId = getSessionFromCookie(request);
  if (!sessionId) {
    return null;
  }

  if (!env.FEEDBACK_KV) {
    return null;
  }

  const sessionStr = await env.FEEDBACK_KV.get(`session:${sessionId}`);
  if (!sessionStr) {
    return null;
  }

  let session;
  try {
    session = JSON.parse(sessionStr);
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > session.expiresAt) {
    await env.FEEDBACK_KV.delete(`session:${sessionId}`);
    return null;
  }

  const token = getTokenFromCookie(request);
  if (session.token !== token) {
    return null;
  }

  const ip = getClientIp(request);
  if (session.ip !== ip) {
    return null;
  }

  return session;
}

export async function requireAuth(request, env) {
  const session = await validateSession(request, env);
  if (!session) {
    return null;
  }
  return session;
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

async function logActivity(env, action, details) {
  if (!env.FEEDBACK_KV) return;
  try {
    const id = generateId(16);
    const timestamp = Date.now();
    const entry = {
      id,
      action,
      timestamp,
      details,
    };
    await env.FEEDBACK_KV.put(`activity:${timestamp}:${id}`, JSON.stringify(entry), {
      expirationTtl: 2592000,
    });
    const indexStr = await env.FEEDBACK_KV.get('activity:index');
    let index = [];
    if (indexStr) {
      try { index = JSON.parse(indexStr); } catch { index = []; }
    }
    index.unshift({ id, timestamp, action });
    if (index.length > 1000) {
      index = index.slice(0, 1000);
    }
    await env.FEEDBACK_KV.put('activity:index', JSON.stringify(index), {
      expirationTtl: 2592000,
    });
  } catch {
  }
}
