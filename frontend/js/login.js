window.SOCKET_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;
window.API_URL = `${window.SOCKET_URL}/api`;

const loginForm = document.getElementById('loginForm');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const alertBox = document.getElementById('alertBox');
const loginBtn = document.getElementById('loginBtn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const phone = phoneInput.value.trim();
  const password = passwordInput.value.trim();

  showAlert('', false);
  loginBtn.innerText = 'Logging in...';
  loginBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));

    showAlert('✅ Login Successful! Redirecting...', false);

    // Role-Based Redirect
    setTimeout(() => {
      if (data.role === 'kitchen') {
        window.location.href = 'kitchen.html'; // Kitchen staff locked to kitchen
      } else {
        window.location.href = 'pos.html'; // Admin & Cashier go to POS
      }
    }, 800);

  } catch (error) {
    showAlert(`❌ ${error.message}`, true);
    loginBtn.innerText = 'Login to POS';
    loginBtn.disabled = false;
  }
});

function showAlert(message, isError = true) {
  if (!message) {
    alertBox.classList.add('hidden');
    return;
  }
  alertBox.innerText = message;
  alertBox.className = 'alert';
  if (!isError) {
    alertBox.style.background = '#DCFCE7';
    alertBox.style.color = '#15803D';
    alertBox.style.borderColor = '#86EFAC';
  } else {
    alertBox.style.background = '#FEE2E2';
    alertBox.style.color = '#DC2626';
    alertBox.style.borderColor = '#FCA5A5';
  }
  alertBox.classList.remove('hidden');
}