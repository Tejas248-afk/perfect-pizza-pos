// 🔥 APNA RENDER BACKEND URL YAHAN DALEIN (Bina aakhiri slash '/')
const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; 

window.SOCKET_URL = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ? 'http://localhost:5000'
  : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;
const API_URL = window.API_URL;

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const alertBox = document.getElementById('alertBox');
  const loginBtn = document.getElementById('loginBtn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const phoneInput = document.getElementById('phone');
      const passwordInput = document.getElementById('password');

      const phone = phoneInput ? phoneInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      if (!phone || !password) {
        showAlert('Please enter phone number and password', 'error');
        return;
      }

      try {
        if (loginBtn) {
          loginBtn.innerText = 'Logging in...';
          loginBtn.disabled = true;
        }

        showAlert('Connecting to server...', 'info');

        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, username: phone, password }),
        });

        const data = await res.json();
        console.log("🔍 Server Login Response:", data);

        // Check if server sent explicit success: false
        if (data.success === false) {
          throw new Error(data.message || 'Login failed. Invalid credentials.');
        }

        if (!res.ok) {
          throw new Error(data.message || `Server error (${res.status})`);
        }

        // 🔥 FLEXIBLE TOKEN EXTRACTOR
        let userToken = data.token || data.accessToken;
        let userData = data.user || data.userData;

        if (!userToken && data.data) {
          userToken = data.data.token || data.data.accessToken;
        }
        if (!userData && data.data) {
          userData = data.data.user || data.data.userData;
        }

        // Fallback: If user data is at top level
        if (userToken && !userData && (data.role || data.name)) {
          userData = {
            _id: data._id || data.id,
            name: data.name || data.username || 'User',
            role: data.role || 'admin',
            phone: data.phone || phone
          };
        }

        // Validation
        if (!userToken) {
          throw new Error(`No token in response. Server sent: ${JSON.stringify(data)}`);
        }

        if (!userData) {
          userData = { name: 'Cashier', role: 'cashier', phone };
        }

        // Save in LocalStorage
        localStorage.setItem('token', userToken);
        localStorage.setItem('user', JSON.stringify(userData));

        showAlert('✅ Login Successful! Redirecting...', 'success');

        // Redirect
        setTimeout(() => {
          if (userData.role === 'kitchen') {
            window.location.href = 'kitchen.html';
          } else {
            window.location.href = 'pos.html';
          }
        }, 600);

      } catch (err) {
        showAlert(err.message || 'Server connection error', 'error');
        if (loginBtn) {
          loginBtn.innerText = 'Login to POS';
          loginBtn.disabled = false;
        }
      }
    });
  }

  function showAlert(msg, type) {
    if (!alertBox) return;
    alertBox.innerText = msg;
    alertBox.className = `alert ${type}`;
    alertBox.classList.remove('hidden');
  }
});