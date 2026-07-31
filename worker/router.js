import { handleSubmit } from './api/v1/public/submit.js';
import { handlePublicConfig } from './api/v1/public/config.js';
import { handleLogin } from './api/v1/auth/login.js';
import { handleLogout } from './api/v1/auth/logout.js';
import { handleCheckSession } from './api/v1/auth/session.js';
import {
  handleGetSubmissions, handleGetSubmission,
  handleArchiveSubmission, handleUnarchiveSubmission,
  handleDeleteSubmission, handleAddNotes,
} from './api/v1/admin/submissions.js';
import { handleGetAnalytics } from './api/v1/admin/analytics.js';
import { handleExport } from './api/v1/admin/export.js';
import { handleGetActivity } from './api/v1/admin/activity.js';
import {
  handleGetConfig, handleUpdateBranding, handleUpdateQuestions,
  handleUpdateDiscord, handleUpdateSettings,
  handlePublishAll, handleDiscardDraft,
  handleGetVersions, handleRestoreVersion,
} from './api/v1/admin/config/index.js';

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({ method, pattern, handler });
    return this;
  }

  async resolve(method, pathname, request, env, ctx) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params = match.slice(1);
        return route.handler(request, env, ctx, ...params);
      }
    }
    return null;
  }
}

export function createRouter() {
  const r = new Router();

  // Public
  r.add('GET', /^\/api\/v1\/public\/config$/, handlePublicConfig);
  r.add('POST', /^\/api\/v1\/public\/submit$/, handleSubmit);

  // Auth
  r.add('POST', /^\/api\/v1\/auth\/login$/, handleLogin);
  r.add('POST', /^\/api\/v1\/auth\/logout$/, handleLogout);
  r.add('GET', /^\/api\/v1\/auth\/session$/, handleCheckSession);

  // Config
  r.add('GET', /^\/api\/v1\/admin\/config(?:\?|$)/, handleGetConfig);
  r.add('PUT', /^\/api\/v1\/admin\/config\/branding$/, handleUpdateBranding);
  r.add('PUT', /^\/api\/v1\/admin\/config\/questions$/, handleUpdateQuestions);
  r.add('PUT', /^\/api\/v1\/admin\/config\/discord$/, handleUpdateDiscord);
  r.add('PUT', /^\/api\/v1\/admin\/config\/settings$/, handleUpdateSettings);
  r.add('POST', /^\/api\/v1\/admin\/config\/publish$/, handlePublishAll);
  r.add('POST', /^\/api\/v1\/admin\/config\/discard$/, handleDiscardDraft);
  r.add('GET', /^\/api\/v1\/admin\/config\/versions$/, handleGetVersions);
  r.add('POST', /^\/api\/v1\/admin\/config\/versions\/([a-z0-9]+)\/restore$/, handleRestoreVersion);

  // Admin - submissions
  r.add('GET', /^\/api\/v1\/admin\/submissions$/, handleGetSubmissions);
  r.add('GET', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)$/, handleGetSubmission);
  r.add('DELETE', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)$/, handleDeleteSubmission);
  r.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/archive$/, handleArchiveSubmission);
  r.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/unarchive$/, handleUnarchiveSubmission);
  r.add('POST', /^\/api\/v1\/admin\/submissions\/([a-z0-9]+)\/notes$/, handleAddNotes);

  // Admin - other
  r.add('GET', /^\/api\/v1\/admin\/analytics$/, handleGetAnalytics);
  r.add('GET', /^\/api\/v1\/admin\/export$/, handleExport);
  r.add('GET', /^\/api\/v1\/admin\/activity$/, handleGetActivity);

  return r;
}
