// 🔥 APNA RENDER BACKEND URL YAHAN REPLACE KAREIN
const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; // <-- Put your actual Render URL here

window.SOCKET_URL = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ? 'http://localhost:5000'
  : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;

const API_URL = window.API_URL;

// Login Form Submit Event
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('username') || document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorEl = document.getElementById('errorMessage') || document.getElementById('loginError');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username || !password) {
      if (errorEl) errorEl.innerText = 'Please enter username and password';
      return;
    }

    try {
      if (errorEl) errorEl.innerText = 'Logging in...';

      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Save Token & User in LocalStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Role ke hisaab se Redirect karein
      if (data.user.role === 'kitchen') {
        window.location.href = 'kitchen.html';
      } else {
        window.location.href = 'pos.html';
      }
    } catch (err) {
      if (errorEl) errorEl.innerText = err.message || 'Server connection error';
    }
  });
}