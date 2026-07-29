import { validateSession } from '../models/session.js';
import { getPermissionsForRole } from '../models/admin.js';
import { getClientIp } from '../utils/ip.js';

export async function requireAuth(request, env) {
  const session = await validateSession(request, env);
  if (!session) return null;

  return {
    adminId: session.adminId,
    username: session.username,
    role: session.role,
    expiresAt: session.expiresAt,
  };
}

export async function requirePermission(request, env, permission) {
  const session = await requireAuth(request, env);
  if (!session) return null;

  const perms = await getPermissionsForRole(env, session.role);
  if (!perms.includes(permission)) return null;

  return session;
}
