const RATE_LIMITS = new Map();

export function checkRateLimit(ip, endpoint, maxRequests = 20, windowSeconds = 60) {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const window = windowSeconds * 1000;

  let entry = RATE_LIMITS.get(key);
  if (!entry || now - entry.windowStart > window) {
    entry = { count: 1, windowStart: now };
    RATE_LIMITS.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + window - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}
