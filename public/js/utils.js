const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getConfig() {
  if (typeof window.FEEDBACK_CONFIG !== 'undefined') {
    return window.FEEDBACK_CONFIG;
  }
  return null;
}

export function getAccentColor() {
  const config = getConfig();
  return config && config.site && config.site.accentColor ? config.site.accentColor : '#8B5CF6';
}

export function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function showElement(el) {
  if (el) el.classList.remove('hidden');
}

export function hideElement(el) {
  if (el) el.classList.add('hidden');
}

export function setLoading(button, isLoading, originalText) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Submitting...';
  } else {
    button.disabled = false;
    button.innerHTML = originalText || 'Submit Feedback';
  }
}

export function showNotification(message, type, container) {
  const styles = {
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#34d399', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
    info: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', color: '#a78bfa', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  };

  const s = styles[type] || styles.info;

  const existing = container.querySelector('.notification-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'notification-toast fixed top-4 right-4 z-50 max-w-sm border rounded-lg p-4 shadow-lg transition-all duration-300';
  toast.style.cssText = `background: ${s.bg}; border-color: ${s.border}; color: ${s.color};`;
  toast.innerHTML = `
    <div class="flex items-start">
      <svg class="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${s.icon}"></path>
      </svg>
      <p class="text-sm font-medium">${sanitizeHTML(message)}</p>
      <button class="ml-auto pl-2" onclick="this.parentElement.parentElement.remove()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
