import { getConfig } from '../../js/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('error-message');
  const loginBtn = document.getElementById('login-btn');
  const config = getConfig();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const password = passwordInput.value;
    if (!password) {
      showError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const base = config && config.form && config.form.endpoint
        ? config.form.endpoint.replace('/api/submit', '').replace('/api/v1/public/submit', '')
        : '';
      const endpoint = base + '/api/v1/auth/login';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      const dashboardPath = config && config.admin && config.admin.path
        ? config.admin.path + 'dashboard.html'
        : '/admin/dashboard.html';

      window.location.href = dashboardPath;
    } catch (err) {
      setLoading(false);
      showError(err.message || 'Login failed. Please check your password.');
    }
  });

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function setLoading(isLoading) {
    if (isLoading) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Signing In...';
    } else {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }
});
