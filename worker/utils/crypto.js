export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function generateId(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export function generateToken() {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generatePasswordHash(password) {
  const salt = generateId(16);
  const iterations = 100000;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(bits), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return `pbkdf2:${iterations}:${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('sha256:')) {
    const hex = storedHash.replace('sha256:', '');
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const computed = Array.from(new Uint8Array(hash), b =>
      b.toString(16).padStart(2, '0')
    ).join('');
    return timingSafeEqual(computed, hex);
  }
  const parts = storedHash.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length < 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const computed = Array.from(new Uint8Array(bits), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return timingSafeEqual(computed, hash);
}
