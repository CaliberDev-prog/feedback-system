export async function checkRateLimit(env, ip, endpoint) {
  const maxReqs = parseInt(env.RATE_LIMIT_MAX) || 20;
  const windowSec = parseInt(env.RATE_LIMIT_WINDOW) || 60;
  if (!env.FEEDBACK_KV) return { allowed: true, remaining: maxReqs };

  const key = `rl:${ip}:${endpoint}`;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSec);

  const storageKey = `${key}:${windowKey}`;
  const current = await env.FEEDBACK_KV.get(storageKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxReqs) {
    const retryAfter = windowSec - (now % windowSec);
    return { allowed: false, remaining: 0, retryAfter };
  }

  await env.FEEDBACK_KV.put(storageKey, String(count + 1), { expirationTtl: windowSec + 60 });
  return { allowed: true, remaining: maxReqs - count - 1 };
}
