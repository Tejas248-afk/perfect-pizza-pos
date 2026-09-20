// 🔥 APNA RENDER BACKEND URL YAHAN LIKHO
const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; // <-- CHANGE THIS

window.SOCKET_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;

const API_URL = window.API_URL;
const SOCKET_URL = window.SOCKET_URL;

let token = localStorage.getItem('token');
let user = null;

try {
  const userStr = localStorage.getItem('user');
  if (userStr && userStr !== 'undefined') {
    user = JSON.parse(userStr);
  }
} catch (e) {
  localStorage.clear();
}

if (!token || !user) {
  localStorage.clear();
  window.location.href = 'index.html';
}

// --- SECURITY & ROLE ACCESS GUARD ---
const currentPage = window.location.pathname.split('/').pop();

if (user.role === 'kitchen' && !currentPage.includes('kitchen.html')) {
  window.location.href = 'kitchen.html';
}

if (user.role === 'cashier') {
  const adminPages = ['menu-manager.html', 'reports.html', 'settings.html'];
  if (adminPages.some((page) => currentPage.includes(page))) {
    alert('⛔ Access Denied: Only Admins can view this page.');
    window.location.href = 'pos.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (user.role === 'cashier') {
    document
      .querySelectorAll(
        'a[href="menu-manager.html"], a[href="reports.html"], a[href="settings.html"]'
      )
      .forEach((btn) => {
        btn.style.display = 'none';
      });
  }
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.innerText = `👤 ${user.name} (${user.role})`;
});

// ------------------------------------
// --- TABLES RENDER & SMART TIMER ---
// ------------------------------------
async function loadTables() {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_URL}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tables = await res.json();

    if (!Array.isArray(tables) || tables.length === 0) {
      const seedBtn = document.getElementById('seedTablesBtn');
      if (seedBtn) seedBtn.classList.remove('hidden');
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = tables
      .map((t) => {
        const order = t.currentOrder;
        const isOccupied = t.status === 'occupied' && order;

        // SMART TABLE TIMER
        let timerBadge = '';
        let borderStyle = '';

        if (isOccupied && order.createdAt) {
          const startTime = new Date(order.createdAt).getTime();
          const mins = Math.floor((Date.now() - startTime) / (1000 * 60));

          let timerClass = 'timer-green';
          if (mins >= 45) {
            timerClass = 'timer-red-pulse';
          } else if (mins >= 20) {
            timerClass = 'timer-yellow';
          }

          timerBadge = `<div class="table-timer ${timerClass}">⏱️ ${mins} mins</div>`;
          borderStyle = `border: 2px solid ${
            timerClass === 'timer-red-pulse'
              ? '#EF4444'
              : timerClass === 'timer-yellow'
              ? '#F59E0B'
              : '#10B981'
          };`;
        }

        return `
        <div class="table-card ${t.status}" style="${
          isOccupied ? borderStyle : ''
        }; position: relative;" onclick="handleTableClick('${t._id}', '${t.name}', '${
          order ? order._id : ''
        }')">
          ${timerBadge}
          <div class="table-icon">🪑</div>
          <div class="table-name">${t.name}</div>
          <div class="status-badge">${t.status}</div>
          ${
            isOccupied
              ? `
            <div class="table-details">
              Order: <b>${order.orderNumber}</b><br>
              Bill: <b>₹${order.grandTotal}</b><br>
              Items: ${order.items?.length || 0}
            </div>
          `
              : '<div class="table-details">Tap to start order</div>'
          }
        </div>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Error loading tables:', err);
    grid.innerHTML = `<div class="empty-state">⚠️ Backend not connected<br><small>${err.message}</small></div>`;
  }
}

async function seedTables() {
  try {
    await fetch(`${API_URL}/tables/seed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const seedBtn = document.getElementById('seedTablesBtn');
    if (seedBtn) seedBtn.classList.add('hidden');
    loadTables();
  } catch (err) {
    alert('Error seeding tables');
  }
}

function handleTableClick(tableId, tableName, orderId) {
  if (orderId && orderId !== 'undefined') {
    localStorage.setItem('runningTableId', tableId);
    localStorage.setItem('runningOrderId', orderId);
    localStorage.setItem('runningTableName', tableName);
    window.location.href = 'pos.html?mode=add-kot';
  } else {
    localStorage.setItem('selectedTableId', tableId);
    localStorage.setItem('selectedTableName', tableName);
    window.location.href = 'pos.html?mode=dine-in';
  }
}

// ========== NIGHT MODE ==========
function applyNightMode() {
  const on = localStorage.getItem('nightMode') === '1';
  document.body.classList.toggle('night-mode', on);
  const btn = document.getElementById('nightModeBtn');
  if (btn) btn.innerText = on ? '☀️ Day' : '🌙 Night';
}

function toggleNightMode() {
  const on = localStorage.getItem('nightMode') === '1';
  localStorage.setItem('nightMode', on ? '0' : '1');
  applyNightMode();
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// page load
document.addEventListener('DOMContentLoaded', applyNightMode);
applyNightMode();

loadTables();
setInterval(loadTables, 10000);