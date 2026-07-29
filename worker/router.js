import { handleSubmit } from './api/v1/public/submit.js';
import { handleLogin } from './api/v1/auth/login.js';
import { handleLogout } from './api/v1/auth/logout.js';
import { handleCheckSession } from './api/v1/auth/session.js';
import {
  handleGetSubmissions,
  handleGetSubmission,
  handleArchiveSubmission,
  handleUnarchiveSubmission,
  handleDeleteSubmission,
  handleAddNotes,
} from './api/v1/admin/submissions.js';
import { handleGetAnalytics } from './api/v1/admin/analytics.js';
import { handleExport } from './api/v1/admin/export.js';
import { handleGetActivity } from './api/v1/admin/activity.js';

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({ method, pattern, handler });
    return this;
  }

  async resolve(method, pathname, request, env) {
    const apiPattern = /^\/api\/v1\//;
    if (!apiPattern.test(pathname)) return null;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params = match.slice(1);
        return route.handler(request, env, ...params);
      }
    }

    return null;
  }
}

export function createRouter() {
  const router = new Router();

  // Public
  router.add('POST', /^\/api\/v1\/public\/submit$/, handleSubmit);

  // Auth
  router.add('POST', /^\/api\/v1\/auth\/login$/, handleLogin);
  router.add('POST', /^\/api\/v1\/auth\/logout$/, handleLogout);
  router.add('GET', /^\/api\/v1\/auth\/session$/, handleCheckSession);

  // Admin - submissions
  router.add('GET', /^\/api\/v1\/admin\/submissions$/, handleGetSubmissions);
  router.add('GET', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)$/, handleGetSubmission);
  router.add('DELETE', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)$/, handleDeleteSubmission);
  router.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/archive$/, handleArchiveSubmission);
  router.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/unarchive$/, handleUnarchiveSubmission);
  router.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/notes$/, handleAddNotes);

  // Admin - other
  router.add('GET', /^\/api\/v1\/admin\/analytics$/, handleGetAnalytics);
  router.add('GET', /^\/api\/v1\/admin\/export$/, handleExport);
  router.add('GET', /^\/api\/v1\/admin\/activity$/, handleGetActivity);

  // Legacy paths (unversioned) - redirect internally
  addLegacyRoutes(router);

  return router;
}

function addLegacyRoutes(router) {
  // Map old paths to new handlers
  const legacy = [
    ['POST', /^\/api\/submit$/, handleSubmit],
    ['POST', /^\/api\/admin\/login$/, handleLogin],
    ['POST', /^\/api\/admin\/logout$/, handleLogout],
    ['GET', /^\/api\/admin\/session$/, handleCheckSession],
    ['GET', /^\/api\/admin\/submissions$/, handleGetSubmissions],
    ['GET', /^\/api\/admin\/submissions\/([a-z0-9]+)$/, handleGetSubmission],
    ['DELETE', /^\/api\/admin\/submissions\/([a-z0-9]+)$/, handleDeleteSubmission],
    ['POST', /^\/api\/admin\/submissions\/([a-z0-9]+)\/archive$/, handleArchiveSubmission],
    ['POST', /^\/api\/admin\/submissions\/([a-z0-9]+)\/unarchive$/, handleUnarchiveSubmission],
    ['POST', /^\/api\/admin\/submissions\/([a-z0-9]+)\/notes$/, handleAddNotes],
    ['GET', /^\/api\/admin\/analytics$/, handleGetAnalytics],
    ['GET', /^\/api\/admin\/export$/, handleExport],
    ['GET', /^\/api\/admin\/activity$/, handleGetActivity],
  ];

  for (const [method, pattern, handler] of legacy) {
    router.add(method, pattern, handler);
  }
}
