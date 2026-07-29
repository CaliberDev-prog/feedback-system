import { getConfig, formatDate, formatDateShort, sanitizeHTML } from '../../js/utils.js';

const API_BASE = (() => {
  const config = getConfig();
  if (config && config.form && config.form.endpoint) {
    return config.form.endpoint.replace('/api/submit', '').replace('/api/v1/public/submit', '');
  }
  return '';
})();

let currentView = 'overview';
let submissionsCache = [];
let submissionsTotal = 0;
let currentPage = 1;
let currentSearch = '';
let currentFilter = '';
let chartInstance = null;
let sessionInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
  sessionInfo = await checkSession();
  if (!sessionInfo) return;
  document.getElementById('session-info').textContent = `Signed in as ${sessionInfo.admin.username}`;
  document.getElementById('sidebar-role').textContent = `Role: ${sessionInfo.admin.role}`;
  bindNavigation();
  bindLogout();
  bindMobileToggle();
  switchView('overview');
});

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/session`, { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');
    return await res.json();
  } catch {
    try {
      const res = await fetch(`${API_BASE}/api/admin/session`, { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      return await res.json();
    } catch {
      const config = getConfig();
      window.location.href = (config && config.admin && config.admin.path) || '/admin/';
      return null;
    }
  }
}

function bindNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
}

function bindLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }); } catch {}
    const config = getConfig();
    window.location.href = (config && config.admin && config.admin.path) || '/admin/';
  });
}

function bindMobileToggle() {
  const toggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove('open');
    }
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  const titles = {
    overview: 'Overview', responses: 'Responses', analytics: 'Analytics',
    forms: 'Forms', questions: 'Questions', branding: 'Branding',
    discord: 'Discord', activity: 'Activity Log',
  };
  document.getElementById('page-title').textContent = titles[view] || 'Overview';
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sidebar.classList.remove('open');
  const renderers = {
    overview: renderOverview, responses: renderResponses, analytics: renderAnalytics,
    forms: renderForms, questions: renderQuestions, branding: renderBranding,
    discord: renderDiscord, activity: renderActivity,
  };
  (renderers[view] || renderOverview)();
}

async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  try {
    const res = await fetch(url, { credentials: 'include', ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ===== OVERVIEW =====
async function renderOverview() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in">
      <div class="stat-card"><h3>Total Submissions</h3><p class="stat-value" id="stat-total">-</p></div>
      <div class="stat-card"><h3>This Month</h3><p class="stat-value" id="stat-month">-</p></div>
      <div class="stat-card"><h3>This Week</h3><p class="stat-value" id="stat-week">-</p></div>
      <div class="stat-card"><h3>Today</h3><p class="stat-value" id="stat-today">-</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>Recent Responses</h2></div><div class="card-body" id="recent-submissions"><p style="color: var(--text-muted);" class="text-sm">Loading...</p></div></div>
      <div class="card"><div class="card-header"><h2>Rating Distribution</h2></div><div class="card-body" id="rating-dist"><p style="color: var(--text-muted);" class="text-sm">Loading...</p></div></div>
    </div>`;
  const data = await apiFetch('/api/v1/admin/analytics') || await apiFetch('/api/admin/analytics');
  if (data) {
    document.getElementById('stat-total').textContent = (data.stats.total || 0).toLocaleString();
    document.getElementById('stat-month').textContent = (data.stats.month || 0).toLocaleString();
    document.getElementById('stat-week').textContent = (data.stats.week || 0).toLocaleString();
    document.getElementById('stat-today').textContent = (data.stats.today || 0).toLocaleString();
    renderRatingDistribution(data.ratingDistribution, data.averageRating, data.ratingCount);
  }
  const subs = await apiFetch('/api/v1/admin/submissions?limit=5') || await apiFetch('/api/admin/submissions?limit=5');
  if (subs) renderRecentSubmissions(subs.submissions);
}

function renderRecentSubmissions(submissions) {
  const container = document.getElementById('recent-submissions');
  if (!submissions || submissions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);" class="text-sm text-center py-8">No submissions yet.</p>'; return;
  }
  container.innerHTML = submissions.map(s => `
    <div class="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer rounded px-2 -mx-2" data-id="${s.id}" style="border-color: var(--border-light);">
      <div><p class="text-sm font-medium" style="color: var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color: var(--text-muted);">Anonymous</span>'}</p>
        <p class="text-xs" style="color: var(--text-muted);">${formatDateShort(s.timestamp)}</p></div>
      <span class="badge badge-info text-xs">${s.answers.length} fields</span>
    </div>`).join('');
  container.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => openSubmissionModal(el.dataset.id)));
}

function renderRatingDistribution(distribution, average, count) {
  const container = document.getElementById('rating-dist');
  if (!distribution || Object.keys(distribution).length === 0 || !count) {
    container.innerHTML = '<p style="color: var(--text-muted);" class="text-sm text-center py-8">No ratings yet.</p>'; return;
  }
  const maxCount = Math.max(...Object.values(distribution));
  const ratings = Object.entries(distribution).sort((a, b) => b[0] - a[0]);
  const bars = ratings.map(([rating, cnt]) => {
    const pct = maxCount > 0 ? (cnt / maxCount) * 100 : 0;
    const stars = '\u2605'.repeat(Number(rating)) + '\u2606'.repeat(Math.max(0, 5 - Number(rating)));
    return `<div class="flex items-center gap-3"><span class="text-sm w-20" style="color: var(--text-muted);">${stars}</span>
      <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: var(--border-light);">
      <div class="h-full rounded-full" style="width: ${pct}%; background: var(--warning);"></div></div>
      <span class="text-sm w-8 text-right" style="color: var(--text-muted);">${cnt}</span></div>`;
  }).join('');
  container.innerHTML = `<div class="text-center mb-4"><span class="text-3xl font-bold" style="color: var(--text);">${average}</span>
    <span style="color: var(--text-muted);" class="ml-1">/ 5</span>
    <p class="text-sm" style="color: var(--text-muted);">${count} ratings</p></div>
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
        <option value="">All Active</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <button id="export-btn" class="px-4 py-2 border rounded-lg text-sm flex items-center gap-2" style="border-color: var(--border); color: var(--text-muted); background: var(--card-alt);">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export CSV
      </button>
    </div>
    <div class="card fade-in">
      <div class="card-body p-0"><div style="overflow-x: auto;">
        <table class="data-table" id="submissions-table">
          <thead><tr><th>Submitted</th><th>Discord</th><th>Responses</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="submissions-body"><tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">Loading...</td></tr></tbody>
        </table></div></div>
      <div class="px-6 py-3 border-t flex items-center justify-between text-sm" style="border-color: var(--border); color: var(--text-muted);" id="pagination"></div>
    </div>`;
  document.getElementById('search-input').addEventListener('input', e => { currentSearch = e.target.value; currentPage = 1; loadSubmissions(); });
  document.getElementById('filter-select').addEventListener('change', e => { currentFilter = e.target.value; currentPage = 1; loadSubmissions(); });
  document.getElementById('export-btn').addEventListener('click', () => { window.open(`${API_BASE}/api/v1/admin/export?format=csv`, '_blank'); });
  await loadSubmissions();
}

async function loadSubmissions() {
  const tbody = document.getElementById('submissions-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">Loading...</td></tr>';
  let url = `${API_BASE}/api/v1/admin/submissions?page=${currentPage}&limit=20`;
  if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
  if (currentFilter === 'archived') url += '&archived=true';
  if (currentFilter === 'active') url += '&archived=false';
  const data = await apiFetch(url);
  if (data) {
    submissionsCache = data.submissions;
    submissionsTotal = data.total;
    renderSubmissionsTable(data.submissions);
    renderPagination();
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--error);">Failed to load.</td></tr>';
  }
}

function renderSubmissionsTable(submissions) {
  const tbody = document.getElementById('submissions-body');
  if (!submissions || submissions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">No submissions found.</td></tr>'; return;
  }
  tbody.innerHTML = submissions.map(s => `
    <tr class="cursor-pointer" data-id="${s.id}">
      <td class="text-sm whitespace-nowrap" style="color: var(--text);">${formatDateShort(s.timestamp)}</td>
      <td class="text-sm" style="color: var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color: var(--text-muted);">-</span>'}</td>
      <td class="text-sm" style="color: var(--text-muted);">${s.answers.length} answers</td>
      <td>${s.archived ? '<span class="badge badge-warning">Archived</span>' : '<span class="badge badge-success">Active</span>'}</td>
      <td><div class="flex items-center gap-2">
        <button class="view-btn text-sm" style="color: var(--accent);" data-id="${s.id}">View</button>
        ${s.archived ? `<button class="unarchive-btn text-sm" style="color: var(--text-muted);" data-id="${s.id}">Restore</button>`
          : `<button class="archive-btn text-sm" style="color: var(--text-muted);" data-id="${s.id}">Archive</button>`}
        <button class="delete-btn text-sm" style="color: var(--error);" data-id="${s.id}">Delete</button>
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
  container.innerHTML = `<span>Page ${currentPage} of ${totalPages} (${submissionsTotal} submissions)</span>
    <div class="flex gap-2">
      <button class="px-3 py-1 border rounded text-sm" style="border-color: var(--border);${currentPage <= 1 ? 'color:var(--text-dim);' : ''}" ${currentPage <= 1 ? 'disabled' : ''} id="prev-page">Previous</button>
      <button class="px-3 py-1 border rounded text-sm" style="border-color: var(--border);${currentPage >= totalPages ? 'color:var(--text-dim);' : ''}" ${currentPage >= totalPages ? 'disabled' : ''} id="next-page">Next</button></div>`;
  document.getElementById('prev-page')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadSubmissions(); } });
  document.getElementById('next-page')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadSubmissions(); } });
}

async function openSubmissionModal(id) {
  const sub = await apiFetch(`/api/v1/admin/submissions/${id}`) || await apiFetch(`/api/admin/submissions/${id}`);
  if (!sub) { showModal('Error', '<p style="color: var(--error);">Failed to load.</p>'); return; }
  const answersHtml = sub.answers.map(a => {
    let v = Array.isArray(a.value) ? (a.value.length > 0 ? a.value.join(', ') : '<span style="color:var(--text-muted);">None</span>')
      : a.type === 'rating' ? (() => { const n = Math.max(1, Math.min(10, Number(a.value))); return '\u2605'.repeat(Math.min(n,5)) + '\u2606'.repeat(Math.max(0,5-Math.min(n,5))) + ` (${n})`; })()
      : a.value || '<span style="color:var(--text-muted);">-</span>';
    return `<div class="mb-3"><p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:var(--text-muted);">${sanitizeHTML(a.label||a.id)}</p>
      <p class="text-sm" style="color:var(--text);">${v}</p></div>`;
  }).join('');
  const html = `
    <div class="modal-header"><h2>Submission Details</h2>
      <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <div class="modal-body">
      <div class="flex items-center justify-between mb-4 pb-4 border-b" style="border-color:var(--border);">
        <div><p class="text-sm" style="color:var(--text-muted);">Submitted ${formatDate(sub.timestamp)}</p>
          <p class="text-sm" style="color:var(--text-muted);">Discord: ${sub.discord ? sanitizeHTML(sub.discord) : '<span style="color:var(--text-dim);">Not provided</span>'}</p></div>
        <span class="${sub.archived ? 'badge badge-warning' : 'badge badge-success'}">${sub.archived ? 'Archived' : 'Active'}</span></div>
      ${answersHtml}
      <div class="mt-4 pt-4 border-t" style="border-color:var(--border);">
        <label class="text-xs font-semibold uppercase tracking-wide mb-1 block" style="color:var(--text-muted);">Internal Notes</label>
        <textarea id="notes-textarea" class="w-full px-3 py-2 border rounded-lg text-sm mt-1 outline-none" rows="3" placeholder="Add notes..." style="background:var(--card-alt);border-color:var(--border);color:var(--text);">${sanitizeHTML(sub.notes||'')}</textarea>
        <button id="save-notes-btn" class="mt-2 px-3 py-1.5 text-white text-sm rounded-lg" style="background:var(--accent);" data-id="${sub.id}">Save Notes</button></div></div>
    <div class="modal-footer">
      ${sub.archived ? `<button class="px-4 py-2 border rounded-lg text-sm unarchive-modal-btn" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);" data-id="${sub.id}">Restore</button>`
        : `<button class="px-4 py-2 border rounded-lg text-sm archive-modal-btn" style="border-color:var(--border);color:var(--text-muted);background:var(--card-alt);" data-id="${sub.id}">Archive</button>`}
      <button class="px-4 py-2 text-white rounded-lg text-sm delete-modal-btn" style="background:var(--error);" data-id="${sub.id}">Delete</button></div>`;
  showModal(null, '', html);
  document.querySelector('.modal-close')?.addEventListener('click', () => document.getElementById('modal-container').innerHTML = '');
  document.getElementById('save-notes-btn')?.addEventListener('click', async e => {
    const n = document.getElementById('notes-textarea').value;
    await fetch(`${API_BASE}/api/v1/admin/submissions/${e.target.dataset.id}/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({notes:n}), credentials:'include' });
    showToast('Notes saved.', 'success');
  });
  document.querySelector('.archive-modal-btn')?.addEventListener('click', async e => { await archiveSub(e.target.dataset.id); document.getElementById('modal-container').innerHTML = ''; });
  document.querySelector('.unarchive-modal-btn')?.addEventListener('click', async e => { await unarchiveSub(e.target.dataset.id); document.getElementById('modal-container').innerHTML = ''; });
  document.querySelector('.delete-modal-btn')?.addEventListener('click', async e => { if (confirm('Delete this submission?')) { await deleteSub(e.target.dataset.id); document.getElementById('modal-container').innerHTML = ''; } });
}

async function archiveSub(id) {
  const res = await fetch(`${API_BASE}/api/v1/admin/submissions/${id}/archive`, { method: 'POST', credentials: 'include' });
  if (res.ok) { showToast('Archived.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
}
async function unarchiveSub(id) {
  const res = await fetch(`${API_BASE}/api/v1/admin/submissions/${id}/unarchive`, { method: 'POST', credentials: 'include' });
  if (res.ok) { showToast('Restored.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
}
async function deleteSub(id) {
  const res = await fetch(`${API_BASE}/api/v1/admin/submissions/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { showToast('Deleted.', 'success'); if (currentView === 'responses') loadSubmissions(); else renderOverview(); }
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
  const data = await apiFetch('/api/v1/admin/analytics') || await apiFetch('/api/admin/analytics');
  if (data) {
    document.getElementById('avg-rating').textContent = data.averageRating || '-';
    document.getElementById('total-ratings').textContent = data.ratingCount || 0;
    document.getElementById('total-subs').textContent = (data.stats.total || 0).toLocaleString();
    document.getElementById('active-rate').textContent = data.stats.total > 0 ? Math.round((data.stats.month / data.stats.total) * 100) + '%' : '-';
    if (data.timeline && data.timeline.length) renderTimelineChart(data.timeline);
    const distContainer = document.getElementById('analytics-rating-dist');
    if (data.ratingDistribution && Object.keys(data.ratingDistribution).length) {
      renderRatingDistributionInto(data.ratingDistribution, distContainer);
    } else {
      distContainer.innerHTML = '<p class="text-center py-8" style="color:var(--text-muted);">No ratings yet.</p>';
    }
  }
}

function renderTimelineChart(timeline) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: timeline.map(d => { const p = d.date.split('-'); return `${p[1]}/${p[2]}`; }),
      datasets: [{ label: 'Submissions', data: timeline.map(d => d.count),
        backgroundColor: 'rgba(139, 92, 246, 0.3)', borderColor: 'rgba(139, 92, 246, 0.8)', borderWidth: 2, borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a24', titleColor: '#f0f0f5', bodyColor: '#a0a0b8', borderColor: '#2a2a3a', borderWidth: 1 } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6a6a80' }, grid: { color: '#2a2a3a' } }, x: { grid: { display: false }, ticks: { color: '#6a6a80' } } }
    }
  });
}

function renderRatingDistributionInto(distribution, container) {
  const maxCount = Math.max(...Object.values(distribution));
  const ratings = Object.entries(distribution).sort((a, b) => b[0] - a[0]);
  container.innerHTML = ratings.map(([r, c]) => {
    const pct = maxCount > 0 ? (c / maxCount) * 100 : 0;
    return `<div class="flex items-center gap-3 mb-2"><span class="text-sm w-16" style="color:var(--text-muted);">${r} star${r>1?'s':''}</span>
      <div class="flex-1 h-4 rounded-full overflow-hidden" style="background:var(--border-light);">
      <div class="h-full rounded-full flex items-center justify-end px-2 text-xs text-white font-medium" style="width:${Math.max(pct,5)}%;background:var(--accent);">${c}</div></div></div>`;
  }).join('');
}

// ===== FORMS =====
function renderForms() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in"><div class="card-header"><h2>Form Configuration</h2></div>
      <div class="card-body">
        <p class="text-sm mb-4" style="color:var(--text-muted);">Edit your form's behavior and appearance in <code style="color:var(--accent);">public/config.js</code>.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-lg border" style="border-color:var(--border);background:var(--card-alt);">
            <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Form Settings</h3>
            <ul class="text-xs space-y-2" style="color:var(--text-muted);">
              <li><span style="color:var(--accent);">endpoint</span> &mdash; API submission endpoint</li>
              <li><span style="color:var(--accent);">successMessage</span> &mdash; Thank you text</li>
              <li><span style="color:var(--accent);">submitButtonText</span> &mdash; Button label</li>
              <li><span style="color:var(--accent);">showDiscordField</span> &mdash; Toggle Discord field</li>
            </ul></div>
          <div class="p-4 rounded-lg border" style="border-color:var(--border);background:var(--card-alt);">
            <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Success Page</h3>
            <ul class="text-xs space-y-2" style="color:var(--text-muted);">
              <li><span style="color:var(--accent);">title</span> &mdash; Success heading</li>
              <li><span style="color:var(--accent);">message</span> &mdash; Thank you message</li>
              <li><span style="color:var(--accent);">redirectUrl</span> &mdash; Auto-redirect</li>
              <li><span style="color:var(--accent);">redirectDelay</span> &mdash; Wait before redirect</li>
            </ul></div></div>
        <div class="mt-6 p-4 rounded-lg" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);">
          <p class="text-xs" style="color:var(--accent);">Changes to form configuration require editing <code>public/config.js</code> and redeploying.</p></div></div></div>`;
}

// ===== QUESTIONS =====
function renderQuestions() {
  const config = getConfig();
  const questions = config && config.questions ? config.questions : [];
  const typeInfo = {
    rating: 'Star rating 1-10', text: 'Short text input', textarea: 'Long text area',
    select: 'Single select dropdown', dropdown: 'Alias for select', checkboxes: 'Multi-select chips', yesno: 'Yes/No toggle'
  };
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in"><div class="card-header"><h2>Questions (${questions.length})</h2></div>
      <div class="card-body p-0"><div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>#</th><th>Label</th><th>Type</th><th>Required</th><th>Options / Details</th></tr></thead>
          <tbody>${questions.map((q, i) => `
            <tr><td class="text-sm" style="color:var(--text-muted);">${i+1}</td>
              <td class="text-sm" style="color:var(--text);">${sanitizeHTML(q.label)}</td>
              <td><span class="badge badge-info">${q.type}</span></td>
              <td>${q.required ? '<span class="badge badge-success">Required</span>' : '<span style="color:var(--text-muted);">Optional</span>'}</td>
              <td class="text-sm" style="color:var(--text-muted);">${q.options ? q.options.join(', ') : q.type === 'rating' ? `${q.min||1} - ${q.max||5}` : q.type === 'text' || q.type === 'textarea' ? `max: ${q.maxLength||200}` : '-'}</td></tr>`).join('')}
          </tbody></table></div></div>
      <div class="px-6 py-3 border-t" style="border-color:var(--border);">
        <p class="text-xs" style="color:var(--text-muted);">Supported types: ${Object.keys(typeInfo).join(', ')}</p></div></div>`;
}

// ===== BRANDING =====
function renderBranding() {
  const config = getConfig();
  const s = config && config.site ? config.site : {};
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in"><div class="card-header"><h2>Branding</h2></div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-lg border" style="border-color:var(--border);background:var(--card-alt);">
            <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Current Settings</h3>
            <table class="text-xs w-full" style="color:var(--text-muted);">
              <tr class="border-b" style="border-color:var(--border-light);"><td class="py-1 pr-4 font-medium" style="color:var(--text);">Title</td><td>${sanitizeHTML(s.title||'Feedback')}</td></tr>
              <tr class="border-b" style="border-color:var(--border-light);"><td class="py-1 pr-4 font-medium" style="color:var(--text);">Description</td><td>${sanitizeHTML(s.description||'')}</td></tr>
              <tr class="border-b" style="border-color:var(--border-light);"><td class="py-1 pr-4 font-medium" style="color:var(--text);">Accent Color</td><td><span class="inline-block w-4 h-4 rounded align-middle mr-1" style="background:${s.accentColor||'#8B5CF6'};"></span> ${s.accentColor||'#8B5CF6'}</td></tr>
              <tr class="border-b" style="border-color:var(--border-light);"><td class="py-1 pr-4 font-medium" style="color:var(--text);">Theme</td><td>${s.theme||'dark'}</td></tr>
              <tr><td class="py-1 pr-4 font-medium" style="color:var(--text);">Footer</td><td>${sanitizeHTML(s.footer||'')}</td></tr>
            </table></div>
          <div class="p-4 rounded-lg border" style="border-color:var(--border);background:var(--card-alt);">
            <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Available Options</h3>
            <ul class="text-xs space-y-2" style="color:var(--text-muted);">
              <li><span style="color:var(--accent);">title</span> &mdash; Site name</li>
              <li><span style="color:var(--accent);">description</span> &mdash; Tagline</li>
              <li><span style="color:var(--accent);">logo</span> &mdash; Logo path</li>
              <li><span style="color:var(--accent);">favicon</span> &mdash; Tab icon</li>
              <li><span style="color:var(--accent);">accentColor</span> &mdash; Primary color</li>
              <li><span style="color:var(--accent);">theme</span> &mdash; dark / light / system</li>
              <li><span style="color:var(--accent);">footer</span> &mdash; Footer text</li>
            </ul></div></div></div></div>`;
}

// ===== DISCORD =====
function renderDiscord() {
  const config = getConfig();
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in"><div class="card-header"><h2>Discord Integration</h2></div>
      <div class="card-body">
        <div class="p-4 rounded-lg mb-4" style="background:var(--card-alt);border:1px solid var(--border);">
          <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Webhook Status</h3>
          <p class="text-xs" style="color:var(--text-muted);">Webhook is configured via the <code style="color:var(--accent);">DISCORD_WEBHOOK_URL</code> environment variable.</p>
          <div class="mt-3 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span><span class="text-sm" style="color:var(--text);">Connected</span></div></div>
        <div class="p-4 rounded-lg" style="background:var(--card-alt);border:1px solid var(--border);">
          <h3 class="text-sm font-semibold mb-2" style="color:var(--text);">Submission Embed</h3>
          <p class="text-xs" style="color:var(--text-muted);">Each new submission sends a rich embed to your Discord channel with all answers formatted as fields.</p>
          <ul class="text-xs mt-2 space-y-1" style="color:var(--text-muted);">
            <li>&bull; Star ratings displayed as stars</li>
            <li>&bull; Checkboxes as bullet list</li>
            <li>&bull; Yes/No as toggle value</li>
            <li>&bull; Discord username included if provided</li>
          </ul></div></div></div>`;
}

// ===== ACTIVITY =====
async function renderActivity() {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="card fade-in"><div class="card-header"><h2>Activity Log</h2></div>
    <div class="card-body p-0"><div id="activity-list"><p class="text-center py-8" style="color:var(--text-muted);">Loading...</p></div></div></div>`;
  const data = await apiFetch('/api/v1/admin/activity') || await apiFetch('/api/admin/activity');
  const list = data && data.activity ? data.activity : [];
  const container = document.getElementById('activity-list');
  if (!list.length) { container.innerHTML = '<p class="text-center py-8" style="color:var(--text-muted);">No activity yet.</p>'; return; }
  const labels = { login_success: 'Login', login_failed: 'Failed login', logout: 'Logout',
    submission_created: 'New submission', submission_archived: 'Archived', submission_unarchived: 'Restored',
    submission_deleted: 'Deleted', notes_added: 'Notes added', export: 'Exported data' };
  container.innerHTML = list.map(a => {
    const label = labels[a.action] || a.action;
    const colors = { login_success: '#34d399', login_failed: '#f87171', logout: '#6a6a80',
      submission_created: '#a78bfa', submission_archived: '#fbbf24', submission_unarchived: '#34d399',
      submission_deleted: '#f87171', notes_added: '#a78bfa', export: '#60a5fa' };
    const c = colors[a.action] || '#6a6a80';
    return `<div class="flex items-center gap-3 px-6 py-3 border-b last:border-0" style="border-color:var(--border-light);">
      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${c}22;">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:${c};"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div class="flex-1"><p class="text-sm" style="color:var(--text);">${label}</p>
        <p class="text-xs" style="color:var(--text-muted);">${formatDateShort(a.timestamp)}${a.adminUsername ? ' by '+sanitizeHTML(a.adminUsername) : ''}</p></div>
      ${a.submissionId ? `<span class="text-xs font-mono" style="color:var(--text-dim);">${a.submissionId.slice(0,8)}</span>` : ''}</div>`;
  }).join('');
}

// ===== SHARED UI =====
function showModal(title, bodyHtml, customHtml) {
  const container = document.getElementById('modal-container');
  if (customHtml) {
    container.innerHTML = `<div class="modal-overlay fade-in" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content">${customHtml}</div></div>`;
  } else {
    container.innerHTML = `<div class="modal-overlay fade-in" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content">
      <div class="modal-header"><h2>${title}</h2>
        <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML=''" style="color:var(--text-muted);">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
      <div class="modal-body">${bodyHtml}</div></div></div>`;
  }
}

function showToast(message, type) {
  const colors = { success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#34d399' }, error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171' } };
  const s = colors[type] || colors.success;
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50 max-w-sm border rounded-lg p-4 shadow-lg transition-all duration-300';
  toast.style.cssText = `background:${s.bg};border-color:${s.border};color:${s.color};`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3000);
}
