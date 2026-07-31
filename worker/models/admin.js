import { generateId, generatePasswordHash, verifyPassword, timingSafeEqual } from '../utils/crypto.js';

export async function authenticateAdmin(env, password) {
  const row = await env.DB.prepare(
    'SELECT id, username, password_hash, display_name, role FROM admins WHERE enabled = 1 LIMIT 1'
  ).first();
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function updateAdminPassword(env, adminId, newPassword) {
  const hash = await generatePasswordHash(newPassword);
  await env.DB.prepare(
    "UPDATE admins SET password_hash = ? WHERE id = ?"
  ).bind(hash, adminId).run();
  return true;
}

export async function getAdminById(env, id) {
  const row = await env.DB.prepare(
    'SELECT id, username, display_name, role FROM admins WHERE id = ? AND enabled = 1'
  ).bind(id).first();
  if (!row) return null;
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role };
}

export async function updateLastLogin(env, id, ip) {
  await env.DB.prepare(
    "UPDATE admins SET last_login = datetime('now'), last_ip = ? WHERE id = ?"
  ).bind(ip, id).run();
}

export async function getPermissionsForRole(env, role) {
  const rows = await env.DB.prepare(
    'SELECT permission FROM permissions WHERE role = ?'
  ).bind(role).all();
  return rows.results.map(r => r.permission);
}

export async function hasPermission(env, role, permission) {
  const row = await env.DB.prepare(
    'SELECT id FROM permissions WHERE role = ? AND permission = ?'
  ).bind(role, permission).first();
  return !!row;
}
