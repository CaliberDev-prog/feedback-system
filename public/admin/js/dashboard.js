import { getConfig, formatDate, formatDateShort, sanitizeHTML } from '../../js/utils.js';

const API_BASE = (() => {
  const config = getConfig();
  if (config && config.form && config.form.endpoint) {
    return config.form.endpoint.replace('/api/submit', '');
  }
  return '';
})();

let currentView = 'dashboard';
let submissionsCache = [];
let submissionsTotal = 0;
let currentPage = 1;
let currentSearch = '';
let currentFilter = '';
let chartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  const valid = await checkSession();
  if (!valid) return;

  bindNavigation();
  bindLogout();
  bindMobileToggle();
  switchView('dashboard');
});

async function checkSession() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/session`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    return true;
  } catch {
    const config = getConfig();
    const loginPath = config && config.admin && config.admin.path
      ? config.admin.path
      : '/admin/';
    window.location.href = loginPath;
    return false;
  }
}

function bindNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });
}

function bindLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    const config = getConfig();
    const loginPath = config && config.admin && config.admin.path
      ? config.admin.path
      : '/admin/';
    window.location.href = loginPath;
  });
}

function bindMobileToggle() {
  const toggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

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
    dashboard: 'Dashboard',
    submissions: 'Submissions',
    analytics: 'Analytics',
    activity: 'Activity Log',
  };
  document.getElementById('page-title').textContent = titles[view] || 'Dashboard';

  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }

  switch (view) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'submissions':
      renderSubmissions();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'activity':
      renderActivity();
      break;
  }
}

async function renderDashboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in">
      <div class="stat-card"><h3>Total Submissions</h3><p class="stat-value" id="stat-total">-</p></div>
      <div class="stat-card"><h3>This Month</h3><p class="stat-value" id="stat-month">-</p></div>
      <div class="stat-card"><h3>This Week</h3><p class="stat-value" id="stat-week">-</p></div>
      <div class="stat-card"><h3>Today</h3><p class="stat-value" id="stat-today">-</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
      <div class="card"><div class="card-header"><h2>Recent Submissions</h2></div><div class="card-body" id="recent-submissions"><p style="color: var(--text-muted);" class="text-sm">Loading...</p></div></div>
      <div class="card"><div class="card-header"><h2>Rating Distribution</h2></div><div class="card-body" id="rating-dist"><p style="color: var(--text-muted);" class="text-sm">Loading...</p></div></div>
    </div>
  `;

  try {
    const [statsRes, subsRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/analytics`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/admin/submissions?limit=5`, { credentials: 'include' }),
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('stat-total').textContent = stats.stats.total.toLocaleString();
      document.getElementById('stat-month').textContent = stats.stats.month.toLocaleString();
      document.getElementById('stat-week').textContent = stats.stats.week.toLocaleString();
      document.getElementById('stat-today').textContent = stats.stats.today.toLocaleString();

      renderRatingDistribution(stats.ratingDistribution, stats.averageRating, stats.ratingCount);
    }

    if (subsRes.ok) {
      const subs = await subsRes.json();
      renderRecentSubmissions(subs.submissions);
    }
  } catch (err) {
    content.innerHTML = '<div class="text-center py-8 fade-in" style="color: var(--error);">Failed to load dashboard data.</div>';
  }
}

function renderRecentSubmissions(submissions) {
  const container = document.getElementById('recent-submissions');
  if (!submissions || submissions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);" class="text-sm text-center py-8">No submissions yet.</p>';
    return;
  }

  container.innerHTML = submissions.map((s) => `
    <div class="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer rounded px-2 -mx-2 transition-colors" data-id="${s.id}" style="border-color: var(--border-light);">
      <div>
        <p class="text-sm font-medium" style="color: var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color: var(--text-muted);">Anonymous</span>'}</p>
        <p class="text-xs" style="color: var(--text-muted);">${formatDateShort(s.timestamp)}</p>
      </div>
      <span class="badge badge-info text-xs">${s.answers.length} fields</span>
    </div>
  `).join('');

  container.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => openSubmission(el.dataset.id));
  });
}

function renderRatingDistribution(distribution, average, count) {
  const container = document.getElementById('rating-dist');
  if (!distribution || Object.keys(distribution).length === 0 || !count) {
    container.innerHTML = '<p style="color: var(--text-muted);" class="text-sm text-center py-8">No ratings yet.</p>';
    return;
  }

  const maxCount = Math.max(...Object.values(distribution));
  const ratings = Object.entries(distribution).sort((a, b) => b[0] - a[0]);

  let bars = ratings.map(([rating, cnt]) => {
    const pct = maxCount > 0 ? (cnt / maxCount) * 100 : 0;
    const stars = '\u2605'.repeat(Number(rating)) + '\u2606'.repeat(Math.max(0, 5 - Number(rating)));
    return `
      <div class="flex items-center gap-3">
        <span class="text-sm w-20" style="color: var(--text-muted);">${stars}</span>
        <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: var(--border-light);">
          <div class="h-full rounded-full transition-all" style="width: ${pct}%; background: var(--warning);"></div>
        </div>
        <span class="text-sm w-8 text-right" style="color: var(--text-muted);">${cnt}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="text-center mb-4">
      <span class="text-3xl font-bold" style="color: var(--text);">${average}</span>
      <span style="color: var(--text-muted);" class="ml-1">/ 5</span>
      <p class="text-sm" style="color: var(--text-muted);">${count} ratings</p>
    </div>
    <div class="space-y-2">${bars}</div>
  `;
}

async function renderSubmissions() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3 mb-6 fade-in">
      <div class="search-wrapper flex-1">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" class="search-input" id="search-input" placeholder="Search submissions..." />
      </div>
      <select class="filter-select" id="filter-select">
        <option value="">All Submissions</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <button id="export-btn" class="px-4 py-2 border rounded-lg text-sm flex items-center gap-2 transition-colors" style="border-color: var(--border); color: var(--text-muted); background: var(--card-alt);">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export
      </button>
    </div>
    <div class="card fade-in">
      <div class="card-body p-0">
        <div style="overflow-x: auto;">
          <table class="data-table" id="submissions-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Discord</th>
                <th>Responses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="submissions-body">
              <tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="px-6 py-3 border-t flex items-center justify-between text-sm" style="border-color: var(--border); color: var(--text-muted);" id="pagination"></div>
    </div>
  `;

  document.getElementById('search-input').addEventListener('input', (e) => {
    currentSearch = e.target.value;
    currentPage = 1;
    loadSubmissions();
  });

  document.getElementById('filter-select').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    currentPage = 1;
    loadSubmissions();
  });

  document.getElementById('export-btn').addEventListener('click', handleExport);

  await loadSubmissions();
}

async function loadSubmissions() {
  const tbody = document.getElementById('submissions-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">Loading...</td></tr>';

  try {
    let url = `${API_BASE}/api/admin/submissions?page=${currentPage}&limit=20`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
    if (currentFilter === 'archived') url += '&archived=true';
    if (currentFilter === 'active') url += '&archived=false';

    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    submissionsCache = data.submissions;
    submissionsTotal = data.total;

    renderSubmissionsTable(submissionsCache);
    renderPagination();
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--error);">Failed to load submissions.</td></tr>';
  }
}

function renderSubmissionsTable(submissions) {
  const tbody = document.getElementById('submissions-body');

  if (!submissions || submissions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8" style="color: var(--text-muted);">No submissions found.</td></tr>';
    return;
  }

  tbody.innerHTML = submissions.map((s) => `
    <tr class="cursor-pointer" data-id="${s.id}">
      <td class="text-sm whitespace-nowrap" style="color: var(--text);">${formatDateShort(s.timestamp)}</td>
      <td class="text-sm" style="color: var(--text);">${s.discord ? sanitizeHTML(s.discord) : '<span style="color: var(--text-muted);">-</span>'}</td>
      <td class="text-sm" style="color: var(--text-muted);">${s.answers.length} answers</td>
      <td>${s.archived ? '<span class="badge badge-warning">Archived</span>' : '<span class="badge badge-success">Active</span>'}</td>
      <td>
        <div class="flex items-center gap-2">
          <button class="view-btn text-sm" style="color: var(--accent);" data-id="${s.id}">View</button>
          ${s.archived
            ? `<button class="unarchive-btn text-sm" style="color: var(--text-muted);" data-id="${s.id}">Restore</button>`
            : `<button class="archive-btn text-sm" style="color: var(--text-muted);" data-id="${s.id}">Archive</button>`
          }
          <button class="delete-btn text-sm" style="color: var(--error);" data-id="${s.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openSubmission(btn.dataset.id); });
  });

  tbody.querySelectorAll('.archive-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); archiveSubmission(btn.dataset.id); });
  });

  tbody.querySelectorAll('.unarchive-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); unarchiveSubmission(btn.dataset.id); });
  });

  tbody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSubmission(btn.dataset.id); });
  });

  tbody.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => openSubmission(row.dataset.id));
  });
}

function renderPagination() {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(submissionsTotal / 20);

  if (totalPages <= 1) {
    container.innerHTML = `<span>${submissionsTotal} submission${submissionsTotal !== 1 ? 's' : ''}</span>`;
    return;
  }

  container.innerHTML = `
    <span>Page ${currentPage} of ${totalPages} (${submissionsTotal} submissions)</span>
    <div class="flex gap-2">
      <button class="px-3 py-1 border rounded text-sm" style="border-color: var(--border); ${currentPage <= 1 ? 'color: var(--text-dim);' : ''}" ${currentPage <= 1 ? 'disabled' : ''} id="prev-page">Previous</button>
      <button class="px-3 py-1 border rounded text-sm" style="border-color: var(--border); ${currentPage >= totalPages ? 'color: var(--text-dim);' : ''}" ${currentPage >= totalPages ? 'disabled' : ''} id="next-page">Next</button>
    </div>
  `;

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadSubmissions(); }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; loadSubmissions(); }
  });
}

async function openSubmission(id) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/submissions/${id}`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Not found');

    const sub = await response.json();
    showSubmissionModal(sub);
  } catch {
    showModal('Error', '<p style="color: var(--error);">Failed to load submission.</p>');
  }
}

function showSubmissionModal(sub) {
  const answersHtml = sub.answers.map((a) => {
    let displayVal;
    if (Array.isArray(a.value)) {
      displayVal = a.value.length > 0 ? a.value.join(', ') : '<span style="color: var(--text-muted);">None selected</span>';
    } else if (a.type === 'rating') {
      const val = Math.max(1, Math.min(10, Number(a.value)));
      const stars = '\u2605'.repeat(Math.min(val, 5)) + '\u2606'.repeat(Math.max(0, 5 - Math.min(val, 5)));
      displayVal = `${stars} (${val})`;
    } else if (a.value) {
      displayVal = a.value;
    } else {
      displayVal = '<span style="color: var(--text-muted);">-</span>';
    }

    return `
      <div class="mb-3">
        <p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--text-muted);">${sanitizeHTML(a.label || a.id)}</p>
        <p class="text-sm" style="color: var(--text);">${displayVal}</p>
      </div>
    `;
  }).join('');

  const modalContent = `
    <div class="modal-header">
      <h2>Submission Details</h2>
      <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML = ''" style="color: var(--text-muted);">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="flex items-center justify-between mb-4 pb-4 border-b" style="border-color: var(--border);">
        <div>
          <p class="text-sm" style="color: var(--text-muted);">Submitted ${formatDate(sub.timestamp)}</p>
          <p class="text-sm" style="color: var(--text-muted);">Discord: ${sub.discord ? sanitizeHTML(sub.discord) : '<span style="color: var(--text-dim);">Not provided</span>'}</p>
        </div>
        <span class="${sub.archived ? 'badge badge-warning' : 'badge badge-success'}">${sub.archived ? 'Archived' : 'Active'}</span>
      </div>
      ${answersHtml}

      <div class="mt-4 pt-4 border-t" style="border-color: var(--border);">
        <label class="text-xs font-semibold uppercase tracking-wide mb-1 block" style="color: var(--text-muted);">Internal Notes</label>
        <textarea id="notes-textarea" class="w-full px-3 py-2 border rounded-lg text-sm mt-1 outline-none transition-colors" rows="3" placeholder="Add internal notes..." style="background: var(--card-alt); border-color: var(--border); color: var(--text);"></textarea>
        <button id="save-notes-btn" class="mt-2 px-3 py-1.5 text-white text-sm rounded-lg transition-colors" style="background: var(--accent);" data-id="${sub.id}">Save Notes</button>
      </div>
    </div>
    <div class="modal-footer">
      ${sub.archived
        ? `<button class="px-4 py-2 border rounded-lg text-sm" style="border-color: var(--border); color: var(--text-muted); background: var(--card-alt);" data-id="${sub.id}">Restore</button>`
        : `<button class="px-4 py-2 border rounded-lg text-sm" style="border-color: var(--border); color: var(--text-muted); background: var(--card-alt);" data-id="${sub.id}">Archive</button>`
      }
      <button class="px-4 py-2 text-white rounded-lg text-sm" style="background: var(--error);" data-id="${sub.id}">Delete</button>
    </div>
  `;

  showModal(null, '', modalContent);

  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-container').innerHTML = '';
  });

  document.getElementById('save-notes-btn')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const notes = document.getElementById('notes-textarea').value;
    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
        credentials: 'include',
      });
      if (res.ok) {
        showToast('Notes saved.', 'success');
      }
    } catch {}
  });

  document.querySelector('.archive-modal-btn')?.addEventListener('click', async (e) => {
    await archiveSubmission(e.target.dataset.id);
    document.getElementById('modal-container').innerHTML = '';
  });

  document.querySelector('.unarchive-modal-btn')?.addEventListener('click', async (e) => {
    await unarchiveSubmission(e.target.dataset.id);
    document.getElementById('modal-container').innerHTML = '';
  });

  document.querySelector('.delete-modal-btn')?.addEventListener('click', async (e) => {
    if (confirm('Are you sure you want to delete this submission?')) {
      await deleteSubmission(e.target.dataset.id);
      document.getElementById('modal-container').innerHTML = '';
    }
  });
}

function showModal(title, bodyHtml, customHtml) {
  const container = document.getElementById('modal-container');
  if (customHtml) {
    container.innerHTML = `<div class="modal-overlay fade-in" onclick="if(event.target===this) document.getElementById('modal-container').innerHTML = ''"><div class="modal-content">${customHtml}</div></div>`;
  } else {
    container.innerHTML = `
      <div class="modal-overlay fade-in" onclick="if(event.target===this) document.getElementById('modal-container').innerHTML = ''">
        <div class="modal-content">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close p-1 rounded" onclick="document.getElementById('modal-container').innerHTML = ''" style="color: var(--text-muted);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
        </div>
      </div>
    `;
  }
}

async function archiveSubmission(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/submissions/${id}/archive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      showToast('Submission archived.', 'success');
      if (currentView === 'submissions') loadSubmissions();
      else if (currentView === 'dashboard') renderDashboard();
    }
  } catch {}
}

async function unarchiveSubmission(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/submissions/${id}/unarchive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      showToast('Submission restored.', 'success');
      if (currentView === 'submissions') loadSubmissions();
      else if (currentView === 'dashboard') renderDashboard();
    }
  } catch {}
}

async function deleteSubmission(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/submissions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      showToast('Submission deleted.', 'success');
      if (currentView === 'submissions') loadSubmissions();
      else if (currentView === 'dashboard') renderDashboard();
    }
  } catch {}
}

async function handleExport() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/export?format=csv`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Export downloaded.', 'success');
  } catch {
    showToast('Export failed.', 'error');
  }
}

async function renderAnalytics() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in">
      <div class="stat-card"><h3>Average Rating</h3><p class="stat-value" id="avg-rating">-</p></div>
      <div class="stat-card"><h3>Total Ratings</h3><p class="stat-value" id="total-ratings">-</p></div>
      <div class="stat-card"><h3>Total Submissions</h3><p class="stat-value" id="total-subs">-</p></div>
      <div class="stat-card"><h3>Active Rate</h3><p class="stat-value" id="active-rate">-</p></div>
    </div>
    <div class="card fade-in">
      <div class="card-header"><h2>Submission Timeline (7 Days)</h2></div>
      <div class="card-body">
        <canvas id="timeline-chart" height="200"></canvas>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/api/admin/analytics`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed');

    const data = await response.json();
    document.getElementById('avg-rating').textContent = data.averageRating || '-';
    document.getElementById('total-ratings').textContent = data.ratingCount || 0;
    document.getElementById('total-subs').textContent = data.stats.total.toLocaleString();
    document.getElementById('active-rate').textContent = data.stats.total > 0
      ? Math.round((data.stats.month / data.stats.total) * 100) + '%'
      : '-';

    if (data.timeline && data.timeline.length > 0) {
      renderTimelineChart(data.timeline);
    }
  } catch {
    content.innerHTML += '<div class="text-center py-4 fade-in" style="color: var(--error);">Failed to load analytics.</div>';
  }
}

function renderTimelineChart(timeline) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: timeline.map((d) => {
        const parts = d.date.split('-');
        return `${parts[1]}/${parts[2]}`;
      }),
      datasets: [{
        label: 'Submissions',
        data: timeline.map((d) => d.count),
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderColor: 'rgba(139, 92, 246, 0.8)',
        borderWidth: 2,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a24',
          titleColor: '#f0f0f5',
          bodyColor: '#a0a0b8',
          borderColor: '#2a2a3a',
          borderWidth: 1,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#6a6a80' },
          grid: { color: '#2a2a3a' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6a6a80' },
        },
      },
    },
  });
}

async function renderActivity() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="card fade-in">
      <div class="card-header"><h2>Activity Log</h2></div>
      <div class="card-body p-0">
        <div id="activity-list">
          <p class="text-center py-8" style="color: var(--text-muted);">Loading...</p>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/api/admin/activity`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed');

    const data = await response.json();
    renderActivityList(data.activity);
  } catch {
    document.getElementById('activity-list').innerHTML = '<p class="text-center py-8" style="color: var(--error);">Failed to load activity.</p>';
  }
}

function renderActivityList(activities) {
  const container = document.getElementById('activity-list');

  if (!activities || activities.length === 0) {
    container.innerHTML = '<p class="text-center py-8" style="color: var(--text-muted);">No activity recorded yet.</p>';
    return;
  }

  container.innerHTML = activities.map((a) => {
    const labels = {
      login_success: 'Successful login',
      login_failed: 'Failed login attempt',
      logout: 'Logout',
      submission_created: 'New submission',
      submission_archived: 'Submission archived',
      submission_unarchived: 'Submission restored',
      submission_deleted: 'Submission deleted',
      notes_added: 'Notes added to submission',
    };

    const iconBg = {
      login_success: 'rgba(16,185,129,0.15)',
      login_failed: 'rgba(239,68,68,0.15)',
      logout: 'rgba(255,255,255,0.05)',
      submission_created: 'rgba(139,92,246,0.15)',
      submission_archived: 'rgba(245,158,11,0.15)',
      submission_unarchived: 'rgba(16,185,129,0.15)',
      submission_deleted: 'rgba(239,68,68,0.15)',
      notes_added: 'rgba(139,92,246,0.15)',
    };

    const iconColor = {
      login_success: '#34d399',
      login_failed: '#f87171',
      logout: '#6a6a80',
      submission_created: '#a78bfa',
      submission_archived: '#fbbf24',
      submission_unarchived: '#34d399',
      submission_deleted: '#f87171',
      notes_added: '#a78bfa',
    };

    const label = labels[a.action] || a.action;
    const bg = iconBg[a.action] || 'rgba(255,255,255,0.05)';
    const ic = iconColor[a.action] || '#6a6a80';

    return `
      <div class="flex items-center gap-3 px-6 py-3 border-b last:border-0" style="border-color: var(--border-light);">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${bg};">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: ${ic};"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="flex-1">
          <p class="text-sm" style="color: var(--text);">${label}</p>
          <p class="text-xs" style="color: var(--text-muted);">${formatDateShort(a.timestamp)}</p>
        </div>
        ${a.submissionId ? `<span class="text-xs font-mono" style="color: var(--text-dim);">${a.submissionId.slice(0, 8)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function showToast(message, type) {
  const colors = {
    success: 'rgba(16,185,129,0.15)',
    error: 'rgba(239,68,68,0.15)',
  };
  const textColors = {
    success: '#34d399',
    error: '#f87171',
  };
  const borderColors = {
    success: 'rgba(16,185,129,0.3)',
    error: 'rgba(239,68,68,0.3)',
  };

  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50 max-w-sm border rounded-lg p-4 shadow-lg transition-all duration-300';
  toast.style.cssText = `background: ${colors[type]}; border-color: ${borderColors[type]}; color: ${textColors[type]};`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
