document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.value }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Invalid password.';
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        return;
      }
      if (data.csrfToken) {
        sessionStorage.setItem('csrfToken', data.csrfToken);
      }
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
});
