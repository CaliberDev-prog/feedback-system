import { getConfig, formatDate, formatDateShort, sanitizeHTML } from '../../js/utils.js';

let currentView = 'overview';
let submissionsCache = [];
let submissionsTotal = 0;
let currentPage = 1;
let currentSearch = '';
let currentFilter = '';
let chartInstance = null;
let sessionInfo = null;
let liveConfig = {};
let draftConfig = {};
let configLoaded = false;

const VIEWS = {
  overview: 'Overview', responses: 'Responses', analytics: 'Analytics',
  'form-builder': 'Form Builder', branding: 'Branding Manager',
  discord: 'Discord Integration', settings: 'Settings', activity: 'Activity Log',
};

document.addEventListener('DOMContentLoaded', async () => {
  sessionInfo = await checkSession();
  if (!sessionInfo) return;
  document.getElementById('session-info').textContent = `Signed in as ${sessionInfo.admin.username}`;
  document.getElementById('sidebar-role').textContent = `Role: ${sessionInfo.admin.role}`;
  await loadConfig();
  bindNavigation();
  bindLogout();
  bindMobileToggle();
  switchView('overview');
});

async function checkSession() {
  try {
    const res = await fetch('/api/v1/auth/session', { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();
    return { admin: data.admin || data };
  } catch {
    window.location.href = '/admin/';
    return null;
  }
}

async function loadConfig() {
  const res = await fetch('/api/v1/admin/config?live=false', { credentials: 'include' });
  if (res.ok) {
    draftConfig = await res.json();
    const res2 = await fetch('/api/v1/admin/config?live=true', { credentials: 'include' });
    if (res2.ok) liveConfig = await res2.json();
    configLoaded = true;
  }
}

function bindNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
}

function bindLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await apiPost('/api/v1/auth/logout', {});
    window.location.href = '/admin/';
  });
}

function bindMobileToggle() {
  const toggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== toggle) sidebar.classList.remove('open');
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  document.getElementById('page-title').textContent = VIEWS[view] || 'Overview';
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  renderPublishBar();
  const renderers = {
    overview: renderOverview, responses: renderResponses, analytics: renderAnalytics,
    'form-builder': renderFormBuilder, branding: renderBrandingManager,
    discord: renderDiscordManager, settings: renderSettings, activity: renderActivity,
  };
  (renderers[view] || renderOverview)();
}

function renderPublishBar() {
  const bar = document.getElementById('publish-bar');
  if (!configLoaded) { bar.innerHTML = ''; return; }
  bar.innerHTML = `
    <button id="publish-btn" class="px-3 py-1.5 text-white text-xs rounded-lg font-medium" style="background:var(--accent);">Publish All Changes</button>
    <button id="discard-btn" class="px-3 py-1.5 border rounded-lg text-xs" style="border-color:var(--border);color:var(--text-muted);">Discard Draft</button>`;
  document.getElementById('publish-btn').addEventListener('click', async () => {
    if (!confirm('Publish all pending changes?')) return;
    const csrf = sessionStorage.getItem('csrfToken');
    const res = await fetch('/api/v1/admin/config/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } });
    if (res.ok) { showToast('All changes published!', 'success'); await loadConfig(); }
    else showToast('Failed to publish.', 'error');
  });
  document.getElementById('discard-btn').addEventListener('click', async () => {
    if (!confirm('Discard all draft changes?')) return;
    const csrf = sessionStorage.getItem('csrfToken');
    const res = await fetch('/api/v1/admin/config/discard', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } });
    if (res.ok) { showToast('Draft discarded.', 'success'); await loadConfig(); switchView(currentView); }
    else showToast('Failed to discard.', 'error');
  });
}

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(path, { credentials: 'include', ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function apiPost(path, body) {
  const csrf = sessionStorage.getItem('csrfToken');
  const res = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, body: JSON.stringify(body) });
  return res.ok ? await res.json().catch(() => null) : null;
}

async function apiPut(path, body) {
  const csrf = sessionStorage.getItem('csrfToken');
  const res = await fetch(path, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, body: JSON.stringify(body) });
  return res.ok ? await res.json().catch(() => null) : null;
}

function getDraft(key) { return draftConfig[key] || {}; }
function getLive(key) { return liveConfig[key] || {}; }

// ===== FORM BUILDER =====
async function renderFormBuilder() {
  const content = document.getElementById('page-content');
  const questions = getDraft('questions');
  const qs = Array.isArray(questions) ? questions : [];
  content.innerHTML = `
    <div class="flex items-center justify-between mb-6 fade-in">
      <p class="text-sm" style="color:var(--text-muted);">${qs.length} question${qs.length !== 1 ? 's' : ''} · Drag to reorder</p>
      <div class="flex gap-2">
        <button id="add-question-btn" class="px-3 py-1.5 text-white text-sm rounded-lg" style="background:var(--accent);">+ Add Question</button>
        <button id="preview-form-btn" class="px-3 py-1.5 border rounded-lg text-sm" style="border-color:var(--border);color:var(--text-muted);">Preview</button>
      </div>
    </div>
    <div class="card fade-in">
      <div class="card-body p-4" id="question-list">
        ${qs.length === 0 ? '<p class="text-center py-8" style="color:var(--text-muted);">No questions yet. Click "Add Question" to get started.</p>' : ''}
      </div>
    </div>`;
  renderQuestionList(qs);
  document.getElementById('add-question-btn').addEventListener('click', () => openQuestionEditor(null));
  document.getElementById('preview-form-btn').addEventListener('click', renderFormPreview);
}

function renderQuestionList(questions) {
  const container = document.getElementById('question-list');
  if (!container) return;
  if (!questions || questions.length === 0) {
    container.innerHTML = '<p class="text-center py-8" style="color:var(--text-muted);">No questions yet. Click "Add Question" to get started.</p>';
    return;
  }
  container.innerHTML = questions.map((q, i) => `
    <div class="question-item flex items-center gap-3 p-3 mb-2 rounded-lg border" draggable="true" data-index="${i}" style="border-color:var(--border);background:var(--card-alt);cursor:grab;">
      <div class="drag-handle" style="color:var(--text-dim);cursor:grab;"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium px-2 py-0.5 rounded" style="background:rgba(139,92,246,0.15);color:var(--accent);">${sanitizeHTML(q.type)}</span>
          <span class="text-sm font-medium truncate" style="color:var(--text);">${sanitizeHTML(q.label)}</span>
          ${q.required ? '<span class="text-xs" style="color:var(--error);">*</span>' : ''}
        </div>
        <p class="text-xs mt-0.5" style="color:var(--text-dim);">${q.id}${q.placeholder ? ' · ' + sanitizeHTML(q.placeholder) : ''}</p>
      </div>
      <div class="flex items-center gap-1">
        <button class="edit-q-btn p-1.5 rounded" data-index="${i}" title="Edit" style="color:var(--text-muted);"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
        <button class="clone-q-btn p-1.5 rounded" data-index="${i}" title="Duplicate" style="color:var(--text-muted);"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>
        <button class="delete-q-btn p-1.5 rounded" data-index="${i}" title="Delete" style="color:var(--error);"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
      </div>
    </div>`).join('');

  container.querySelectorAll('.edit-q-btn').forEach(b => b.addEventListener('click', () => { const idx = parseInt(b.dataset.index); openQuestionEditor(idx); }));
  container.querySelectorAll('.clone-q-btn').forEach(b => b.addEventListener('click', async () => {
    const idx = parseInt(b.dataset.index);
    const questions = Array.isArray(getDraft('questions')) ? [...getDraft('questions')] : [];
    const cloned = { ...questions[idx], id: questions[idx].id + '_copy_' + Date.now() };
    questions.splice(idx + 1, 0, cloned);
    await saveQuestions(questions);
  }));
  container.querySelectorAll('.delete-q-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this question?')) return;
    const idx = parseInt(b.dataset.index);
    const questions = Array.isArray(getDraft('questions')) ? [...getDraft('questions')] : [];
    questions.splice(idx, 1);
    await saveQuestions(questions);
  }));

  let dragSrcIdx = null;
  container.querySelectorAll('.question-item').forEach(el => {
    el.addEventListener('dragstart', e => { dragSrcIdx = parseInt(el.dataset.index); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('drop', async e => {
      e.preventDefault();
      const dstIdx = parseInt(el.dataset.index);
      if (dragSrcIdx === dstIdx) return;
      const questions = Array.isArray(getDraft('questions')) ? [...getDraft('questions')] : [];
      const [moved] = questions.splice(dragSrcIdx, 1);
      questions.splice(dstIdx, 0, moved);
      await saveQuestions(questions);
    });
  });
}

async function openQuestionEditor(index) {
  const questions = Array.isArray(getDraft('questions')) ? [...getDraft('questions')] : [];
  const isNew = index === null || index === undefined;
  const q = isNew ? { id: 'q_' + Date.now(), type: 'text', label: '', required: false, placeholder: '', maxLength: 200, min: 1, max: 5, options: [], description: '' } : { ...questions[index] };

  const types = ['text', 'textarea', 'rating', 'select', 'dropdown', 'checkboxes', 'yesno', 'email', 'number', 'phone', 'url', 'divider', 'heading', 'markdown'];
  const html = `
    <div class="modal-header"><h2>${isNew ? 'Add Question' : 'Edit Question'}</h2>
      <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <div class="modal-body">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="text-xs font-semibold" style="color:var(--text-muted);">Label</label>
          <input id="qe-label" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(q.label || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
        <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Type</label>
          <select id="qe-type" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" style="background:var(--card-alt);border-color:var(--border);color:var(--text);">${types.map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Question ID</label>
          <input id="qe-id" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(q.id || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
        <div class="col-span-2"><label class="text-xs font-semibold" style="color:var(--text-muted);">Placeholder</label>
          <input id="qe-placeholder" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(q.placeholder || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
        <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Description</label>
          <input id="qe-desc" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(q.description || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
        <div class="flex items-center gap-4 pt-6">
          <label class="flex items-center gap-2"><input type="checkbox" id="qe-required" ${q.required ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Required</span></label></div>
      </div>
      <div id="qe-extra" class="mt-4 p-4 rounded-lg" style="background:var(--card-alt);border:1px solid var(--border);"></div>
    </div>
    <div class="modal-footer flex justify-end gap-2">
      <button class="px-4 py-2 border rounded-lg text-sm" onclick="document.getElementById('modal-container').innerHTML=''" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);">Cancel</button>
      <button id="qe-save" class="px-4 py-2 text-white rounded-lg text-sm" style="background:var(--accent);">${isNew ? 'Add' : 'Save'} Question</button></div>`;
  showModal(null, '', html);

  renderExtraFields(q.type, q);
  document.getElementById('qe-type').addEventListener('change', (e) => renderExtraFields(e.target.value, q));
  document.getElementById('qe-save').addEventListener('click', async () => {
    const updated = {
      id: document.getElementById('qe-id').value.trim() || 'q_' + Date.now(),
      type: document.getElementById('qe-type').value,
      label: document.getElementById('qe-label').value.trim(),
      required: document.getElementById('qe-required').checked,
      placeholder: document.getElementById('qe-placeholder').value.trim() || undefined,
      description: document.getElementById('qe-desc').value.trim() || undefined,
    };
    const extra = collectExtraFields(updated.type);
    Object.assign(updated, extra);
    const newQuestions = Array.isArray(getDraft('questions')) ? [...getDraft('questions')] : [];
    if (isNew) newQuestions.push(updated);
    else newQuestions[index] = updated;
    await saveQuestions(newQuestions);
  });
}

function renderExtraFields(type, q) {
  const container = document.getElementById('qe-extra');
  if (!container) return;
  let html = '';
  if (['text', 'textarea', 'email', 'phone', 'url'].includes(type)) {
    html = `<label class="text-xs font-semibold" style="color:var(--text-muted);">Max Length</label>
      <input id="qe-maxlen" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.maxLength || 200}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" />`;
  } else if (type === 'rating') {
    html = `<div class="flex gap-4"><div><label class="text-xs font-semibold" style="color:var(--text-muted);">Min</label>
      <input id="qe-min" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.min || 1}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
      <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Max</label>
      <input id="qe-max" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.max || 5}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div></div>`;
  } else if (type === 'number') {
    html = `<div class="flex gap-4"><div><label class="text-xs font-semibold" style="color:var(--text-muted);">Min</label>
      <input id="qe-min" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.min !== undefined ? q.min : ''}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
      <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Max</label>
      <input id="qe-max" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.max !== undefined ? q.max : ''}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
      <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Step</label>
      <input id="qe-step" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${q.step !== undefined ? q.step : ''}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div></div>`;
  } else if (['select', 'dropdown', 'checkboxes'].includes(type)) {
    const opts = Array.isArray(q.options) ? q.options : [];
    html = `<label class="text-xs font-semibold" style="color:var(--text-muted);">Options (one per line)</label>
      <textarea id="qe-options" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" rows="5" style="background:var(--card-alt);border-color:var(--border);color:var(--text);font-family:monospace;">${opts.join('\n')}</textarea>`;
  } else if (type === 'heading') {
    html = `<label class="text-xs font-semibold" style="color:var(--text-muted);">Size</label>
      <select id="qe-size" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" style="background:var(--card-alt);border-color:var(--border);color:var(--text);">
        <option value="h1" ${q.size === 'h1' ? 'selected' : ''}>Heading 1</option>
        <option value="h2" ${q.size === 'h2' ? 'selected' : ''}>Heading 2</option>
        <option value="h3" ${q.size === 'h3' ? 'selected' : ''}>Heading 3</option>
      </select>`;
  } else if (type === 'markdown') {
    html = `<label class="text-xs font-semibold" style="color:var(--text-muted);">Content</label>
      <textarea id="qe-content" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" rows="5" style="background:var(--card-alt);border-color:var(--border);color:var(--text);font-family:monospace;">${sanitizeHTML(q.content || '')}</textarea>`;
  } else {
    html = '<p class="text-xs" style="color:var(--text-dim);">No extra configuration needed for this type.</p>';
  }
  container.innerHTML = html;
}

function collectExtraFields(type) {
  const extra = {};
  if (['text', 'textarea', 'email', 'phone', 'url'].includes(type)) {
    const ml = document.getElementById('qe-maxlen');
    if (ml) extra.maxLength = parseInt(ml.value) || 200;
  }
  if (['rating', 'number'].includes(type)) {
    const minEl = document.getElementById('qe-min');
    const maxEl = document.getElementById('qe-max');
    if (minEl) extra.min = minEl.value !== '' ? parseFloat(minEl.value) : undefined;
    if (maxEl) extra.max = maxEl.value !== '' ? parseFloat(maxEl.value) : undefined;
  }
  if (type === 'number') {
    const stepEl = document.getElementById('qe-step');
    if (stepEl) extra.step = stepEl.value !== '' ? parseFloat(stepEl.value) : undefined;
  }
  if (['select', 'dropdown', 'checkboxes'].includes(type)) {
    const optsEl = document.getElementById('qe-options');
    if (optsEl) extra.options = optsEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (type === 'heading') {
    const sizeEl = document.getElementById('qe-size');
    if (sizeEl) extra.size = sizeEl.value;
  }
  if (type === 'markdown') {
    const contentEl = document.getElementById('qe-content');
    if (contentEl) extra.content = contentEl.value;
  }
  Object.keys(extra).forEach(k => { if (extra[k] === undefined || extra[k] === null) delete extra[k]; });
  return extra;
}

async function saveQuestions(questions) {
  const result = await apiPut('/api/v1/admin/config/questions', questions);
  if (result) { await loadConfig(); renderFormBuilder(); showToast('Questions saved to draft.', 'success'); }
  else showToast('Failed to save questions.', 'error');
}

function renderFormPreview() {
  const questions = getDraft('questions');
  const qs = Array.isArray(questions) ? questions : [];
  const branding = getDraft('branding');
  const accent = branding.accentColor || '#8B5CF6';
  const html = `
    <div class="modal-header"><h2>Form Preview</h2>
      <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
      <div style="padding:1rem;border-radius:12px;background:${branding.backgroundColor || '#0a0a0f'};">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h2 style="color:${accent};font-size:1.25rem;font-weight:700;margin:0;">${sanitizeHTML(branding.title || 'Feedback')}</h2>
          <p style="color:#a0a0b8;font-size:0.875rem;margin-top:0.25rem;">${sanitizeHTML(branding.description || '')}</p>
        </div>
        ${qs.map((q, i) => {
          if (q.type === 'divider') return '<hr style="border:none;border-top:1px solid #2a2a3a;margin:8px 0;" />';
          if (q.type === 'heading') return `<h${['h1','h2','h3'].includes(q.size) ? q.size : 'h3'} style="color:#f0f0f5;margin:8px 0;font-weight:700;">${sanitizeHTML(q.label)}${q.description ? `<p style="color:#a0a0b8;font-size:0.875rem;margin:4px 0 0;">${sanitizeHTML(q.description)}</p>` : ''}</h${['h1','h2','h3'].includes(q.size) ? q.size : 'h3'}>`;
          if (q.type === 'markdown') return `<div style="color:#a0a0b8;font-size:0.9375rem;line-height:1.6;padding:8px 0;">${sanitizeHTML(q.content || '')}</div>`;
          return `<div style="margin-bottom:1rem;"><label style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem;color:#f0f0f5;">${sanitizeHTML(q.label)}${q.required ? '<span style="color:#ef4444;margin-left:2px;">*</span>' : ''}</label>
            ${q.type === 'textarea' ? `<textarea disabled placeholder="${sanitizeHTML(q.placeholder || '')}" style="width:100%;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid #2a2a3a;background:#14141f;color:#f0f0f5;font-size:0.875rem;min-height:80px;"></textarea>`
            : q.type === 'select' || q.type === 'dropdown' ? `<select disabled style="width:100%;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid #2a2a3a;background:#14141f;color:#f0f0f5;font-size:0.875rem;"><option>Select an option...</option>${(q.options||[]).map(o => `<option>${sanitizeHTML(o)}</option>`).join('')}</select>`
            : q.type === 'checkboxes' ? `<div>${(q.options||[]).map(o => `<label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:#f0f0f5;font-size:0.875rem;"><input type="checkbox" disabled style="accent-color:${accent};" /><span>${sanitizeHTML(o)}</span></label>`).join('')}</div>`
            : q.type === 'yesno' ? `<div style="display:flex;gap:1rem;"><label style="display:flex;align-items:center;gap:0.5rem;color:#f0f0f5;font-size:0.875rem;"><input type="radio" disabled style="accent-color:${accent};" /> Yes</label><label style="display:flex;align-items:center;gap:0.5rem;color:#f0f0f5;font-size:0.875rem;"><input type="radio" disabled style="accent-color:${accent};" /> No</label></div>`
            : q.type === 'rating' ? `<div style="display:flex;gap:0.25rem;">${Array.from({length: q.max || 5}, (_, i) => i + 1).map(i => `<span style="color:#2a2a3a;font-size:1.5rem;cursor:default;">★</span>`).join('')}</div>`
            : q.type === 'number' ? `<input type="number" disabled placeholder="${sanitizeHTML(q.placeholder || '')}" style="width:100%;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid #2a2a3a;background:#14141f;color:#f0f0f5;font-size:0.875rem;" />`
            : `<input type="${q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'url' ? 'url' : 'text'}" disabled placeholder="${sanitizeHTML(q.placeholder || '')}" style="width:100%;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid #2a2a3a;background:#14141f;color:#f0f0f5;font-size:0.875rem;" />`}
            ${q.description ? `<p style="font-size:0.75rem;color:#6a6a80;margin-top:0.25rem;">${sanitizeHTML(q.description)}</p>` : ''}</div>`;
        }).join('')}
        <div style="text-align:center;margin-top:1.5rem;">
          <button disabled style="padding:0.625rem 1.5rem;background:${accent};color:white;border:none;border-radius:8px;font-size:0.875rem;opacity:0.6;">Submit Feedback</button>
        </div>
      </div>
    </div>`;
  showModal(null, '', html);
}

// ===== BRANDING MANAGER =====
async function renderBrandingManager() {
  const b = getDraft('branding');
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>Branding Settings</h2></div>
        <div class="card-body space-y-4">
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Title</label>
            <input id="br-title" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(b.title || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Description</label>
            <textarea id="br-desc" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" rows="3" style="background:var(--card-alt);border-color:var(--border);color:var(--text);">${sanitizeHTML(b.description || '')}</textarea></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Accent Color</label>
              <div class="flex gap-2 mt-1"><input id="br-accent" type="color" value="${b.accentColor || '#5865F2'}" class="h-10 w-10 rounded cursor-pointer border" style="border-color:var(--border);background:var(--card-alt);" />
                <input class="flex-1 px-3 py-2 border rounded-lg text-sm" id="br-accent-text" value="${b.accentColor || '#5865F2'}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Background Color</label>
              <div class="flex gap-2 mt-1"><input id="br-bg" type="color" value="${b.backgroundColor || '#0a0a0f'}" class="h-10 w-10 rounded cursor-pointer border" style="border-color:var(--border);background:var(--card-alt);" />
                <input class="flex-1 px-3 py-2 border rounded-lg text-sm" id="br-bg-text" value="${b.backgroundColor || '#0a0a0f'}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div></div>
          </div>
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Footer Text</label>
            <input id="br-footer" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(b.footer || '')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Logo Path</label>
              <input id="br-logo" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(b.logo || 'assets/logo.svg')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Favicon Path</label>
              <input id="br-favicon" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(b.favicon || 'assets/favicon.svg')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Typography</label>
              <select id="br-typo" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" style="background:var(--card-alt);border-color:var(--border);color:var(--text);">
                ${['system', 'sans', 'serif', 'mono'].map(t => `<option value="${t}" ${(b.typography||'system') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Border Radius</label>
              <input id="br-radius" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${b.borderRadius || 12}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          </div>
          <button id="save-branding-btn" class="px-4 py-2 text-white rounded-lg text-sm" style="background:var(--accent);">Save Branding</button>
        </div>
      </div>
      <div class="card"><div class="card-header"><h2>Live Preview</h2></div>
        <div class="card-body p-4" id="branding-preview">
          <div id="preview-frame" style="padding:1.5rem;border-radius:12px;background:${b.backgroundColor || '#0a0a0f'};border:1px solid #2a2a3a;">
            <div style="text-align:center;">
              <div style="width:48px;height:48px;border-radius:12px;background:${b.accentColor || '#5865F2'};margin:0 auto 0.75rem;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.25rem;">K</div>
              <h2 style="color:#f0f0f5;font-size:1.25rem;font-weight:700;margin:0;">${sanitizeHTML(b.title || 'Feedback')}</h2>
              <p style="color:#a0a0b8;font-size:0.875rem;margin-top:0.25rem;">${sanitizeHTML(b.description || '')}</p>
              <hr style="border:none;border-top:1px solid #2a2a3a;margin:1rem 0;" />
              <p style="color:#6a6a80;font-size:0.75rem;">${sanitizeHTML(b.footer || '')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('br-accent').addEventListener('input', e => { document.getElementById('br-accent-text').value = e.target.value; updateBrandingPreview(); });
  document.getElementById('br-accent-text').addEventListener('input', e => { document.getElementById('br-accent').value = e.target.value; updateBrandingPreview(); });
  document.getElementById('br-bg').addEventListener('input', e => { document.getElementById('br-bg-text').value = e.target.value; updateBrandingPreview(); });
  document.getElementById('br-bg-text').addEventListener('input', e => { document.getElementById('br-bg').value = e.target.value; updateBrandingPreview(); });
  document.getElementById('br-title').addEventListener('input', () => updateBrandingPreview());
  document.getElementById('br-desc').addEventListener('input', () => updateBrandingPreview());
  document.getElementById('br-footer').addEventListener('input', () => updateBrandingPreview());
  document.getElementById('save-branding-btn').addEventListener('click', async () => {
    const branding = {
      title: document.getElementById('br-title').value,
      description: document.getElementById('br-desc').value,
      logo: document.getElementById('br-logo').value || 'assets/logo.svg',
      favicon: document.getElementById('br-favicon').value || 'assets/favicon.svg',
      accentColor: document.getElementById('br-accent-text').value || '#5865F2',
      backgroundColor: document.getElementById('br-bg-text').value || '#0a0a0f',
      theme: 'dark',
      typography: document.getElementById('br-typo').value,
      borderRadius: parseInt(document.getElementById('br-radius').value) || 12,
      footer: document.getElementById('br-footer').value,
      openGraph: { title: '', description: '', image: '' },
      seo: { index: true, follow: true },
    };
    const result = await apiPut('/api/v1/admin/config/branding', branding);
    if (result) { await loadConfig(); showToast('Branding saved to draft.', 'success'); }
    else showToast('Failed to save branding.', 'error');
  });
}

function updateBrandingPreview() {
  const frame = document.getElementById('preview-frame');
  if (!frame) return;
  const bg = document.getElementById('br-bg-text').value || '#0a0a0f';
  const accent = document.getElementById('br-accent-text').value || '#5865F2';
  const title = document.getElementById('br-title').value || 'Feedback';
  const desc = document.getElementById('br-desc').value || '';
  const footer = document.getElementById('br-footer').value || '';
  frame.style.background = bg;
  frame.innerHTML = `
    <div style="text-align:center;">
      <div style="width:48px;height:48px;border-radius:12px;background:${accent};margin:0 auto 0.75rem;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.25rem;">K</div>
      <h2 style="color:#f0f0f5;font-size:1.25rem;font-weight:700;margin:0;">${sanitizeHTML(title)}</h2>
      <p style="color:#a0a0b8;font-size:0.875rem;margin-top:0.25rem;">${sanitizeHTML(desc)}</p>
      <hr style="border:none;border-top:1px solid #2a2a3a;margin:1rem 0;" />
      <p style="color:#6a6a80;font-size:0.75rem;">${sanitizeHTML(footer)}</p>
    </div>`;
}

// ===== DISCORD INTEGRATION =====
async function renderDiscordManager() {
  const d = getDraft('discord');
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>Discord Integration</h2></div>
        <div class="card-body space-y-4">
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Webhook URL</label>
            <input id="disc-webhook" type="password" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="Stored securely as secret" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" />
            <p class="text-xs mt-1" style="color:var(--text-dim);">Update via <code style="color:var(--accent);">npx wrangler secret put DISCORD_WEBHOOK_URL</code></p></div>
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Embed Title</label>
            <input id="disc-title" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(d.embedTitle || 'New Feedback Submission')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Embed Color</label>
            <div class="flex gap-2 mt-1"><input id="disc-color" type="color" value="${d.embedColor || '#5865F2'}" class="h-10 w-10 rounded cursor-pointer border" style="border-color:var(--border);" />
              <input id="disc-color-text" class="flex-1 px-3 py-2 border rounded-lg text-sm" value="${d.embedColor || '#5865F2'}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div></div>
          <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Embed Footer</label>
            <input id="disc-footer" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" value="${sanitizeHTML(d.embedFooter || 'Feedback System')}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2"><input type="checkbox" id="disc-enabled" ${d.enabled !== false ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Enabled</span></label>
            <label class="flex items-center gap-2"><input type="checkbox" id="disc-timestamp" ${d.showTimestamp !== false ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Show Timestamp</span></label>
            <label class="flex items-center gap-2"><input type="checkbox" id="disc-discordfield" ${d.showDiscordField !== false ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Show Discord Field</span></label>
          </div>
          <button id="save-discord-btn" class="px-4 py-2 text-white rounded-lg text-sm" style="background:var(--accent);">Save Discord Settings</button>
        </div>
      </div>
      <div class="card"><div class="card-header"><h2>Webhook Status</h2></div>
        <div class="card-body">
          <div class="flex items-center gap-3 p-4 rounded-lg" style="background:var(--card-alt);border:1px solid var(--border);">
            <span class="w-3 h-3 rounded-full bg-green-500"></span>
            <div><p class="text-sm" style="color:var(--text);">Discord Webhook Active</p>
              <p class="text-xs" style="color:var(--text-muted);">Configured via DISCORD_WEBHOOK_URL secret</p></div>
          </div>
          <div class="mt-4 p-4 rounded-lg" style="background:var(--card-alt);border:1px solid var(--border);">
            <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Submission Embed Preview</h3>
            <div id="discord-embed-preview" style="background:#2f3136;border-radius:8px;padding:1rem;border-left:4px solid ${d.embedColor || '#5865F2'};">
              <p style="color:#dcddde;font-weight:600;font-size:0.9375rem;">${sanitizeHTML(d.embedTitle || 'New Feedback Submission')}</p>
              <div style="color:#b9bbbe;font-size:0.8125rem;margin-top:0.5rem;display:flex;flex-direction:column;gap:0.25rem;">
                <span><strong style="color:#dcddde;">How would you rate...</strong> ★★★★★ (5)</span>
                <span><strong style="color:#dcddde;">Category</strong> Community</span>
                <span><strong style="color:#dcddde;">Tell us more</strong> Great server!</span>
              </div>
              ${d.showTimestamp !== false ? `<p style="color:#72767d;font-size:0.6875rem;margin-top:0.5rem;">Today at 12:00 PM</p>` : ''}
              <p style="color:#72767d;font-size:0.6875rem;margin-top:0.25rem;">${sanitizeHTML(d.embedFooter || 'Feedback System')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('disc-color').addEventListener('input', e => { document.getElementById('disc-color-text').value = e.target.value; });
  document.getElementById('disc-color-text').addEventListener('input', e => { document.getElementById('disc-color').value = e.target.value; });
  document.getElementById('save-discord-btn').addEventListener('click', async () => {
    const discord = {
      enabled: document.getElementById('disc-enabled').checked,
      webhookUrl: document.getElementById('disc-webhook').value || '',
      embedTitle: document.getElementById('disc-title').value || 'New Feedback Submission',
      embedColor: document.getElementById('disc-color-text').value || '#5865F2',
      embedFooter: document.getElementById('disc-footer').value || 'Feedback System',
      showTimestamp: document.getElementById('disc-timestamp').checked,
      showDiscordField: document.getElementById('disc-discordfield').checked,
      discordLabel: 'Discord Username (optional)',
      discordPlaceholder: 'Your Discord username',
    };
    const result = await apiPut('/api/v1/admin/config/discord', discord);
    if (result) { await loadConfig(); showToast('Discord settings saved to draft.', 'success'); }
    else showToast('Failed to save discord settings.', 'error');
  });
}

// ===== SETTINGS =====
async function renderSettings() {
  const s = getDraft('settings');
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in"><div class="card-header"><h2>System Settings</h2></div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <h3 class="text-sm font-semibold" style="color:var(--text);">Rate Limiting</h3>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Max Requests</label>
              <input id="set-rl-max" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.rateLimitMax || 20}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Window (seconds)</label>
              <input id="set-rl-window" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.rateLimitWindow || 60}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <h3 class="text-sm font-semibold mt-4" style="color:var(--text);">Session</h3>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Session TTL (seconds)</label>
              <input id="set-session-ttl" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.sessionTtl || 86400}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
          </div>
          <div class="space-y-4">
            <h3 class="text-sm font-semibold" style="color:var(--text);">Form & Data</h3>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Max Export Size</label>
              <input id="set-export-max" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.maxExportSize || 10000}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Auto-Archive After (days, 0 = off)</label>
              <input id="set-archive-days" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.autoArchiveDays || 0}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <div><label class="text-xs font-semibold" style="color:var(--text-muted);">Data Retention (days, 0 = forever)</label>
              <input id="set-retention" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" type="number" value="${s.retentionDays || 0}" style="background:var(--card-alt);border-color:var(--border);color:var(--text);" /></div>
            <div class="flex items-center gap-3 mt-4">
              <label class="flex items-center gap-2"><input type="checkbox" id="set-maintenance" ${s.maintenanceMode ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Maintenance Mode</span></label>
              <label class="flex items-center gap-2"><input type="checkbox" id="set-form-open" ${s.formOpen !== false ? 'checked' : ''} style="accent-color:var(--accent);" /><span class="text-sm" style="color:var(--text);">Form Open</span></label>
            </div>
          </div>
        </div>
        <button id="save-settings-btn" class="mt-6 px-4 py-2 text-white rounded-lg text-sm" style="background:var(--accent);">Save Settings</button>
      </div>
    </div>`;
  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const settings = {
      rateLimitMax: parseInt(document.getElementById('set-rl-max').value) || 20,
      rateLimitWindow: parseInt(document.getElementById('set-rl-window').value) || 60,
      sessionTtl: parseInt(document.getElementById('set-session-ttl').value) || 86400,
      maxExportSize: parseInt(document.getElementById('set-export-max').value) || 10000,
      autoArchiveDays: parseInt(document.getElementById('set-archive-days').value) || 0,
      retentionDays: parseInt(document.getElementById('set-retention').value) || 0,
      maintenanceMode: document.getElementById('set-maintenance').checked,
      formOpen: document.getElementById('set-form-open').checked,
      timezone: 'UTC', dateFormat: 'YYYY-MM-DD', language: 'en',
    };
    const result = await apiPut('/api/v1/admin/config/settings', settings);
    if (result) { await loadConfig(); showToast('Settings saved to draft.', 'success'); }
    else showToast('Failed to save settings.', 'error');
  });
}

// ===== OVERVIEW =====
async function renderOverview() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in">
      <div class="stat-card"><h3>Total</h3><p class="stat-value" id="stat-total">-</p></div>
      <div class="stat-card"><h3>This Month</h3><p class="stat-value" id="stat-month">-</p></div>
      <div class="stat-card"><h3>This Week</h3><p class="stat-value" id="stat-week">-</p></div>
      <div class="stat-card"><h3>Today</h3><p class="stat-value" id="stat-today">-</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>Recent Responses</h2></div><div class="card-body" id="recent-submissions"><p style="color:var(--text-muted);" class="text-sm text-center py-8">Loading...</p></div></div>
      <div class="card"><div class="card-header"><h2>Rating Distribution</h2></div><div class="card-body" id="rating-dist"><p style="color:var(--text-muted);" class="text-sm text-center py-8">Loading...</p></div></div>
    </div>`;
  const data = await apiFetch('/api/v1/admin/analytics');
  if (data) {
    document.getElementById('stat-total').textContent = (data.stats.total || 0).toLocaleString();
    document.getElementById('stat-month').textContent = (data.stats.month || 0).toLocaleString();
    document.getElementById('stat-week').textContent = (data.stats.week || 0).toLocaleString();
    document.getElementById('stat-today').textContent = (data.stats.today || 0).toLocaleString();
    renderRatingDistribution(data.ratingDistribution, data.averageRating, data.ratingCount);
  }
  const subs = await apiFetch('/api/v1/admin/submissions?limit=5');
  if (subs) renderRecentSubmissions(subs.submissions);
}

function renderRecentSubmissions(submissions) {
  const container = document.getElementById('recent-submissions');
  if (!submissions || submissions.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);" class="text-sm text-center py-8">No submissions yet.</p>'; return;
  }
  container.innerHTML = submissions.map(s => `
    <div class="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer rounded px-2 -mx-2" data-id="${s.id}" style="border-color:var(--border-light);">
      <div><p class="text-sm font-medium" style="color:var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color:var(--text-muted);">Anonymous</span>'}</p>
        <p class="text-xs" style="color:var(--text-muted);">${formatDateShort(s.timestamp)}</p></div>
      <span class="badge badge-info text-xs">${s.answers.length} fields</span>
    </div>`).join('');
  container.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => openSubmissionModal(el.dataset.id)));
}

function renderRatingDistribution(distribution, average, count) {
  const container = document.getElementById('rating-dist');
  if (!distribution || Object.keys(distribution).length === 0 || !count) {
    container.innerHTML = '<p style="color:var(--text-muted);" class="text-sm text-center py-8">No ratings yet.</p>'; return;
  }
  const maxCount = Math.max(...Object.values(distribution));
  const ratings = Object.entries(distribution).sort((a, b) => b[0] - a[0]);
  const bars = ratings.map(([rating, cnt]) => {
    const pct = maxCount > 0 ? (cnt / maxCount) * 100 : 0;
    const stars = '\u2605'.repeat(Number(rating)) + '\u2606'.repeat(Math.max(0, 5 - Number(rating)));
    return `<div class="flex items-center gap-3"><span class="text-sm w-20" style="color:var(--text-muted);">${stars}</span>
      <div class="flex-1 h-2 rounded-full overflow-hidden" style="background:var(--border-light);">
      <div class="h-full rounded-full" style="width:${pct}%;background:var(--warning);"></div></div>
      <span class="text-sm w-8 text-right" style="color:var(--text-muted);">${cnt}</span></div>`;
  }).join('');
  container.innerHTML = `<div class="text-center mb-4"><span class="text-3xl font-bold" style="color:var(--text);">${average}</span>
    <span style="color:var(--text-muted);" class="ml-1">/ 5</span><p class="text-sm" style="color:var(--text-muted);">${count} ratings</p></div>
    <div class="space-y-2">${bars}</div>`;
}

// ===== RESPONSES =====
async function renderResponses() {
  currentPage = 1; currentSearch = ''; currentFilter = '';
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3 mb-6 fade-in">
      <div class="search-wrapper flex-1">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" class="search-input" id="search-input" placeholder="Search responses..." />
      </div>
      <select class="filter-select" id="filter-select">
        <option value="">All Active</option><option value="active">Active</option><option value="archived">Archived</option>
      </select>
      <button id="export-btn" class="px-4 py-2 border rounded-lg text-sm flex items-center gap-2" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export CSV</button>
    </div>
    <div class="card fade-in">
      <div class="card-body p-0"><div style="overflow-x:auto;">
        <table class="data-table" id="submissions-table">
          <thead><tr><th>Submitted</th><th>Discord</th><th>Responses</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="submissions-body"><tr><td colspan="5" class="text-center py-8" style="color:var(--text-muted);">Loading...</td></tr></tbody>
        </table></div></div>
      <div class="px-6 py-3 border-t flex items-center justify-between text-sm" style="border-color:var(--border);color:var(--text-muted);" id="pagination"></div>
    </div>`;
  document.getElementById('search-input').addEventListener('input', e => { currentSearch = e.target.value; currentPage = 1; loadSubmissions(); });
  document.getElementById('filter-select').addEventListener('change', e => { currentFilter = e.target.value; currentPage = 1; loadSubmissions(); });
  document.getElementById('export-btn').addEventListener('click', () => { window.open('/api/v1/admin/export?format=csv', '_blank'); });
  await loadSubmissions();
}

async function loadSubmissions() {
  const tbody = document.getElementById('submissions-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color:var(--text-muted);">Loading...</td></tr>';
  let url = `/api/v1/admin/submissions?page=${currentPage}&limit=20`;
  if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
  if (currentFilter === 'archived') url += '&archived=true';
  if (currentFilter === 'active') url += '&archived=false';
  const data = await apiFetch(url);
  if (data) {
    submissionsCache = data.submissions; submissionsTotal = data.total;
    renderSubmissionsTable(data.submissions); renderPagination();
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color:var(--error);">Failed to load.</td></tr>';
  }
}

function renderSubmissionsTable(submissions) {
  const tbody = document.getElementById('submissions-body');
  if (!submissions || submissions.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color:var(--text-muted);">No submissions found.</td></tr>'; return; }
  tbody.innerHTML = submissions.map(s => `
    <tr class="cursor-pointer" data-id="${s.id}">
      <td class="text-sm whitespace-nowrap" style="color:var(--text);">${formatDateShort(s.timestamp)}</td>
      <td class="text-sm" style="color:var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color:var(--text-muted);">-</span>'}</td>
      <td class="text-sm" style="color:var(--text-muted);">${s.answers.length} answers</td>
      <td>${s.archived ? '<span class="badge badge-warning">Archived</span>' : '<span class="badge badge-success">Active</span>'}</td>
      <td><div class="flex items-center gap-2">
        <button class="view-btn text-sm" style="color:var(--accent);" data-id="${s.id}">View</button>
        ${s.archived ? `<button class="unarchive-btn text-sm" style="color:var(--text-muted);" data-id="${s.id}">Restore</button>` : `<button class="archive-btn text-sm" style="color:var(--text-muted);" data-id="${s.id}">Archive</button>`}
        <button class="delete-btn text-sm" style="color:var(--error);" data-id="${s.id}">Delete</button>
      </div></td></tr>`).join('');
  tbody.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openSubmissionModal(b.dataset.id); }));
  tbody.querySelectorAll('.archive-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); archiveSub(b.dataset.id); }));
  tbody.querySelectorAll('.unarchive-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); unarchiveSub(b.dataset.id); }));
  tbody.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); deleteSub(b.dataset.id); }));
  tbody.querySelectorAll('tr[data-id]').forEach(r => r.addEventListener('click', () => openSubmissionModal(r.dataset.id)));
}

function renderPagination() {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(submissionsTotal / 20);
  if (totalPages <= 1) { container.innerHTML = `<span>${submissionsTotal} submission${submissionsTotal !== 1 ? 's' : ''}</span>`; return; }
  container.innerHTML = `<span>Page ${currentPage} of ${totalPages} (${submissionsTotal})</span>
    <div class="flex gap-2">
      <button class="px-3 py-1 border rounded text-sm" style="border-color:var(--border);${currentPage <= 1 ? 'color:var(--text-dim);' : ''}" ${currentPage <= 1 ? 'disabled' : ''} id="prev-page">Previous</button>
      <button class="px-3 py-1 border rounded text-sm" style="border-color:var(--border);${currentPage >= totalPages ? 'color:var(--text-dim);' : ''}" ${currentPage >= totalPages ? 'disabled' : ''} id="next-page">Next</button></div>`;
  document.getElementById('prev-page')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadSubmissions(); } });
  document.getElementById('next-page')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadSubmissions(); } });
}

async function openSubmissionModal(id) {
  const sub = await apiFetch(`/api/v1/admin/submissions/${id}`);
  if (!sub) { showToast('Failed to load submission.', 'error'); return; }
  const answersHtml = sub.answers.map(a => {
    let v = Array.isArray(a.value) ? (a.value.length > 0 ? a.value.join(', ') : '<span style="color:var(--text-muted);">None</span>')
      : a.type === 'rating' ? (() => { const n = Math.max(1, Math.min(10, Number(a.value))); return '\u2605'.repeat(Math.min(n,5)) + '\u2606'.repeat(Math.max(0,5-Math.min(n,5))) + ` (${n})`; })()
      : a.value || '<span style="color:var(--text-muted);">-</span>';
    return `<div class="mb-3"><p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:var(--text-muted);">${sanitizeHTML(a.label||a.id)}</p><p class="text-sm" style="color:var(--text);">${v}</p></div>`;
  }).join('');
  const html = `
    <div class="modal-header"><h2>Submission Details</h2><button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <div class="modal-body">
      <div class="flex items-center justify-between mb-4 pb-4 border-b" style="border-color:var(--border);">
        <div><p class="text-sm" style="color:var(--text-muted);">Submitted ${formatDate(sub.timestamp)}</p><p class="text-sm" style="color:var(--text-muted);">Discord: ${sub.discord ? sanitizeHTML(sub.discord) : '<span style="color:var(--text-dim);">Not provided</span>'}</p></div>
        <span class="${sub.archived ? 'badge badge-warning' : 'badge badge-success'}">${sub.archived ? 'Archived' : 'Active'}</span></div>
      ${answersHtml}
      <div class="mt-4 pt-4 border-t" style="border-color:var(--border);">
        <label class="text-xs font-semibold uppercase tracking-wide mb-1 block" style="color:var(--text-muted);">Internal Notes</label>
        <textarea id="notes-textarea" class="w-full px-3 py-2 border rounded-lg text-sm mt-1 outline-none" rows="3" placeholder="Add notes..." style="background:var(--card-alt);border-color:var(--border);color:var(--text);">${sanitizeHTML(sub.notes||'')}</textarea>
        <button id="save-notes-btn" class="mt-2 px-3 py-1.5 text-white text-sm rounded-lg" style="background:var(--accent);" data-id="${sub.id}">Save Notes</button></div></div>
    <div class="modal-footer">
      ${sub.archived ? `<button id="modal-restore-btn" class="px-4 py-2 border rounded-lg text-sm" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);">Restore</button>`
        : `<button id="modal-archive-btn" class="px-4 py-2 border rounded-lg text-sm" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);">Archive</button>`}
      <button id="modal-delete-btn" class="px-4 py-2 text-white rounded-lg text-sm" style="background:var(--error);">Delete</button></div>`;
  showModal(null, '', html);
  document.getElementById('save-notes-btn')?.addEventListener('click', async e => {
    const n = document.getElementById('notes-textarea').value;
    await apiPost(`/api/v1/admin/submissions/${e.target.dataset.id}/notes`, { notes: n });
    showToast('Notes saved.', 'success');
  });
  document.getElementById('modal-archive-btn')?.addEventListener('click', () => { closeModal(); archiveSub(sub.id); });
  document.getElementById('modal-restore-btn')?.addEventListener('click', () => { closeModal(); unarchiveSub(sub.id); });
  document.getElementById('modal-delete-btn')?.addEventListener('click', () => {
    if (confirm('Delete this submission?')) { closeModal(); deleteSub(sub.id); }
  });
}

async function archiveSub(id) {
  const res = await fetch(`/api/v1/admin/submissions/${id}/archive`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': sessionStorage.getItem('csrfToken') || '' } });
  if (res.ok) { showToast('Archived.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
  else showToast('Failed to archive.', 'error');
}
async function unarchiveSub(id) {
  const res = await fetch(`/api/v1/admin/submissions/${id}/unarchive`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': sessionStorage.getItem('csrfToken') || '' } });
  if (res.ok) { showToast('Restored.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
  else showToast('Failed to restore.', 'error');
}
async function deleteSub(id) {
  const res = await fetch(`/api/v1/admin/submissions/${id}`, { method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': sessionStorage.getItem('csrfToken') || '' } });
  if (res.ok) { showToast('Deleted.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
  else showToast('Failed to delete.', 'error');
}

// ===== ANALYTICS =====
async function renderAnalytics() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in">
      <div class="stat-card"><h3>Average Rating</h3><p class="stat-value" id="avg-rating">-</p></div>
      <div class="stat-card"><h3>Total Ratings</h3><p class="stat-value" id="total-ratings">-</p></div>
      <div class="stat-card"><h3>Total Submissions</h3><p class="stat-value" id="total-subs">-</p></div>
      <div class="stat-card"><h3>Active Rate</h3><p class="stat-value" id="active-rate">-</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>7-Day Timeline</h2></div><div class="card-body"><canvas id="timeline-chart" height="200"></canvas></div></div>
      <div class="card"><div class="card-header"><h2>Rating Breakdown</h2></div><div class="card-body" id="analytics-rating-dist"></div></div>
    </div>`;
  const data = await apiFetch('/api/v1/admin/analytics');
  if (data) {
    document.getElementById('avg-rating').textContent = data.averageRating || '-';
    document.getElementById('total-ratings').textContent = data.ratingCount || 0;
    document.getElementById('total-subs').textContent = (data.stats.total || 0).toLocaleString();
    document.getElementById('active-rate').textContent = data.stats.total > 0 ? Math.round((data.stats.month / data.stats.total) * 100) + '%' : '-';
    if (data.timeline && data.timeline.length) renderTimelineChart(data.timeline);
    if (data.ratingDistribution && Object.keys(data.ratingDistribution).length) {
      renderRatingDistributionInto(data.ratingDistribution, document.getElementById('analytics-rating-dist'));
    } else {
      document.getElementById('analytics-rating-dist').innerHTML = '<p class="text-center py-8" style="color:var(--text-muted);">No ratings yet.</p>';
    }
  }
}

function renderTimelineChart(timeline) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: timeline.map(d => { const p = d.date.split('-'); return `${p[1]}/${p[2]}`; }),
      datasets: [{ label: 'Submissions', data: timeline.map(d => d.count), backgroundColor: 'rgba(139,92,246,0.3)', borderColor: 'rgba(139,92,246,0.8)', borderWidth: 2, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a24', titleColor: '#f0f0f5', bodyColor: '#a0a0b8', borderColor: '#2a2a3a', borderWidth: 1 } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6a6a80' }, grid: { color: '#2a2a3a' } }, x: { grid: { display: false }, ticks: { color: '#6a6a80' } } } }
  });
}

function renderRatingDistributionInto(distribution, container) {
  const maxCount = Math.max(...Object.values(distribution));
  const ratings = Object.entries(distribution).sort((a, b) => b[0] - a[0]);
  container.innerHTML = ratings.map(([r, c]) => {
    const pct = maxCount > 0 ? (c / maxCount) * 100 : 0;
    return `<div class="flex items-center gap-3 mb-2"><span class="text-sm w-16" style="color:var(--text-muted);">${r} star${r>1?'s':''}</span>
      <div class="flex-1 h-4 rounded-full overflow-hidden" style="background:var(--border-light);"><div class="h-full rounded-full flex items-center justify-end px-2 text-xs text-white font-medium" style="width:${Math.max(pct,5)}%;background:var(--accent);">${c}</div></div></div>`;
  }).join('');
}

// ===== ACTIVITY =====
async function renderActivity() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="card fade-in"><div class="card-header"><h2>Activity Log</h2></div><div class="card-body p-0"><div id="activity-list"><p class="text-center py-8" style="color:var(--text-muted);">Loading...</p></div></div></div>`;
  const data = await apiFetch('/api/v1/admin/activity');
  const list = data && data.activity ? data.activity : [];
  const container = document.getElementById('activity-list');
  if (!list.length) { container.innerHTML = '<p class="text-center py-8" style="color:var(--text-muted);">No activity yet.</p>'; return; }
  const labels = { login_success: 'Login', login_failed: 'Failed login', logout: 'Logout', submission_created: 'New submission', submission_archived: 'Archived', submission_unarchived: 'Restored', submission_deleted: 'Deleted', notes_added: 'Notes added', export: 'Exported data' };
  const colors = { login_success: '#34d399', login_failed: '#f87171', logout: '#6a6a80', submission_created: '#a78bfa', submission_archived: '#fbbf24', submission_unarchived: '#34d399', submission_deleted: '#f87171', notes_added: '#a78bfa', export: '#60a5fa' };
  container.innerHTML = list.map(a => {
    const c = colors[a.action] || '#6a6a80';
    return `<div class="flex items-center gap-3 px-6 py-3 border-b last:border-0" style="border-color:var(--border-light);">
      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${c}22;"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:${c};"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div class="flex-1"><p class="text-sm" style="color:var(--text);">${labels[a.action] || a.action}</p><p class="text-xs" style="color:var(--text-muted);">${formatDateShort(a.timestamp)}${a.adminUsername ? ' by '+sanitizeHTML(a.adminUsername) : ''}</p></div>
      ${a.submissionId ? `<span class="text-xs font-mono" style="color:var(--text-dim);">${a.submissionId.slice(0,8)}</span>` : ''}</div>`;
  }).join('');
}

// ===== SHARED UI =====
function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}

function showModal(title, bodyHtml, customHtml) {
  const container = document.getElementById('modal-container');
  if (customHtml) {
    container.innerHTML = `<div class="modal-overlay fade-in" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content">${customHtml}</div></div>`;
  } else {
    container.innerHTML = `<div class="modal-overlay fade-in" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content">
      <div class="modal-header"><h2>${title}</h2><button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
      <div class="modal-body">${bodyHtml}</div></div></div>`;
  }
}

function showToast(message, type) {
  const colors = { success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#34d399' }, error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171' }, info: { bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)', color: '#60a5fa' } };
  const s = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.style.cssText = `background:${s.bg};border:1px solid ${s.border};color:${s.color};`;
  toast.textContent = message;
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3000);
}
