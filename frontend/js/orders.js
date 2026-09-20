// 🔥 APNA RENDER BACKEND URL YAHAN LIKHO
const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; // <-- CHANGE THIS

window.SOCKET_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;

var SOCKET_URL = window.SOCKET_URL;
var API_URL = window.API_URL;

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
  if (user && user.role === 'cashier') {
    document
      .querySelectorAll(
        'a[href="menu-manager.html"], a[href="reports.html"], a[href="settings.html"]'
      )
      .forEach((btn) => {
        btn.style.display = 'none';
      });
  }
  const userNameEl = document.getElementById('userName');
  if (userNameEl && user) userNameEl.innerText = `👤 ${user.name} (${user.role})`;
});

// ------------------------------------
let currentFilter = 'active';
let allOrders = [];
let socket = null;

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.status;
    renderOrders();
  });
});

// ---------- Socket ----------
function setConnectionStatus(online, text) {
  const el = document.getElementById('connectionStatus');
  if (!el) return;
  el.innerHTML = `<span class="dot ${online ? 'online' : 'offline'}"></span> ${text}`;
}

function connectSocket() {
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    setConnectionStatus(true, 'Live');
    console.log('✅ Orders page socket connected');
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false, 'Offline');
    console.log('❌ Orders page socket disconnected');
  });

  socket.on('connect_error', (err) => {
    setConnectionStatus(false, 'Offline');
    console.error('Socket Error:', err.message);
  });

  socket.on('newOrder', (order) => {
    const idx = allOrders.findIndex((o) => o._id === order._id);
    if (idx >= 0) allOrders[idx] = order;
    else allOrders.unshift(order);

    renderOrders();
    playTripleBeep();
    flashPageTitle();
  });

  socket.on('orderUpdated', (order) => {
    const idx = allOrders.findIndex((o) => o._id === order._id);
    if (idx >= 0) allOrders[idx] = order;
    else allOrders.unshift(order);
    renderOrders();
  });
}

// ---------- Load from API ----------
async function loadOrders() {
  const list = document.getElementById('ordersList');
  if (list) list.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch(`${API_URL}/orders?today=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load orders');

    allOrders = await res.json();
    renderOrders();
  } catch (err) {
    if (list) {
      list.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }
}

// ---------- Filter + Render ----------
function getFilteredOrders() {
  if (currentFilter === 'active') {
    return allOrders.filter((o) => ['new', 'preparing', 'ready'].includes(o.status));
  }
  if (currentFilter === 'all') {
    return allOrders;
  }
  return allOrders.filter((o) => o.status === currentFilter);
}

function renderOrders() {
  const list = document.getElementById('ordersList');
  if (!list) return;

  const orders = getFilteredOrders();

  if (orders.length === 0) {
    list.innerHTML = '<div class="empty-state">No orders found</div>';
    return;
  }

  list.innerHTML = orders
    .map((o) => {
      const time = new Date(o.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const itemsPreview =
        (o.items || [])
          .slice(0, 3)
          .map((i) => `${i.qty}x ${i.product?.name || i.productName || 'Item'}`)
          .join('<br>') +
        (o.items && o.items.length > 3 ? `<br>+${o.items.length - 3} more` : '');

      const nextStatus = {
        new: 'preparing',
        preparing: 'ready',
        ready: 'completed',
      }[o.status];

      const nextLabel = {
        new: '▶ Start Preparing',
        preparing: '✓ Mark Ready',
        ready: '✅ Complete',
      }[o.status];

      const cust =
        o.customer?.phone && o.customer.phone !== 'N/A'
          ? ` · 📞 ${o.customer.phone}`
          : '';
      const name = o.customer?.name ? ` · ${o.customer.name}` : '';
      const addr = o.deliveryAddress
        ? `<div class="order-meta">📍 ${o.deliveryAddress}</div>`
        : '';

      return `
        <div class="order-card" data-id="${o._id}">
          <div class="order-card-header">
            <h3>${o.orderNumber}</h3>
            <span class="badge ${o.status}">${o.status}</span>
          </div>
          <div class="order-meta">
            ${(o.orderType || '').toUpperCase()} · ${time}${cust}${name}
          </div>
          ${addr}
          <div class="order-items">${itemsPreview}</div>
          <div class="order-total">₹${o.grandTotal} · ${(o.paymentMethod || '').toUpperCase()}</div>
          <div class="order-actions">
            ${
              nextStatus
                ? `<button class="btn-status" onclick="updateStatus('${o._id}', '${nextStatus}')">${nextLabel}</button>`
                : ''
            }
            <button class="btn-print" onclick="reprintOrder('${o._id}')">🖨️ Print</button>
            ${
              o.status !== 'cancelled' && o.status !== 'completed'
                ? `<button class="btn-cancel" onclick="updateStatus('${o._id}', 'cancelled')">Cancel</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');
}

// ---------- Status update ----------
async function updateStatus(id, status) {
  try {
    const res = await fetch(`${API_URL}/orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Update failed');

    const order = data.order;
    const idx = allOrders.findIndex((o) => o._id === order._id);
    if (idx >= 0) allOrders[idx] = order;
    else allOrders.unshift(order);

    renderOrders();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Reprint ----------
async function reprintOrder(id) {
  try {
    const order = allOrders.find((o) => o._id === id);
    if (!order) return alert('Order not found');

    const container = document.getElementById('printReceipt');
    if (!container) return;

    let itemsHtml = (order.items || [])
      .map((item) => {
        const name = item.product?.name || item.productName || 'Item';
        const unit = (item.basePrice || 0) + (item.crustPrice || 0) + (item.addonsTotal || 0);
        return `
        <div class="r-row">
          <div class="r-left">
            <div class="r-item">${item.qty} x ${name}</div>
          </div>
          <div class="r-right">₹${unit * item.qty}</div>
        </div>
      `;
      })
      .join('');

    const date = new Date(order.createdAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    container.innerHTML = `
      <div class="receipt">
        <div class="r-center">
          <img src="images/logo.png" class="receipt-logo" style="width:45px; height:auto; margin:0 auto 5px; display:block;" />
          <div class="r-title">PERFECT PIZZA</div>
          <div class="r-sub">100% Pure Mozzarella's Pizza</div>
          <div class="r-sub">Singhpur Chauraha, Kalyanpur</div>
          <div class="r-sub">Ph: 9889229198</div>
          <div class="r-sub">GSTIN: 09BCVPDD4203L2ZB</div>
        </div>
        <div class="r-dash"></div>
        <div class="r-line"><b>Bill No:</b> ${order.orderNumber}</div>
        <div class="r-line"><b>Date:</b> ${date}</div>
        <div class="r-line"><b>Type:</b> ${(order.orderType || '').toUpperCase()}</div>
        <div class="r-dash"></div>
        ${itemsHtml}
        <div class="r-dash"></div>
        <div class="r-row r-total">
          <div class="r-left"><b>TOTAL</b></div>
          <div class="r-right"><b>₹${order.grandTotal}</b></div>
        </div>
        <div class="r-row">
          <div class="r-left">Payment</div>
          <div class="r-right">${(order.paymentMethod || '').toUpperCase()}</div>
        </div>
        <div class="r-dash"></div>
        <div class="r-center r-thanks">Thank You! Visit Again</div>
      </div>
    `;

    container.classList.add('print-only');
    window.print();
  } catch (err) {
    alert(err.message);
  }
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// ==========================================
// 🔔 3-TIMES BEEP
// ==========================================
let lastOrderSoundAt = 0;
let isBeeping = false;

function playTripleBeep() {
  const now = Date.now();
  if (now - lastOrderSoundAt < 2000 || isBeeping) return;
  lastOrderSoundAt = now;
  isBeeping = true;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const beep = (startTime, freq = 980) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);

      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.exponentialRampToValueAtTime(0.25, startTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);

      o.start(startTime);
      o.stop(startTime + 0.14);
    };

    const t = ctx.currentTime;
    beep(t + 0.0, 880);
    beep(t + 0.18, 990);
    beep(t + 0.36, 1100);

    setTimeout(() => {
      isBeeping = false;
      ctx.close?.();
    }, 700);
  } catch (e) {
    isBeeping = false;
    console.log('Sound error:', e);
  }
}

function flashPageTitle() {
  const old = document.title;
  let i = 0;
  const timer = setInterval(() => {
    document.title = i % 2 === 0 ? '🔔 NEW ORDER!' : old;
    i++;
    if (i > 6) {
      clearInterval(timer);
      document.title = old;
    }
  }, 400);
}

document.getElementById('enableSoundBtn')?.addEventListener('click', () => {
  playTripleBeep();
  localStorage.setItem('soundEnabled', '1');
  alert('✅ Sound Enabled for Live Orders!');
});

// ==========================================
// 🌙 NIGHT MODE
// ==========================================
function applyNightMode() {
  const isNight = localStorage.getItem('nightMode') === '1';
  document.body.classList.toggle('night-mode', isNight);

  const btn = document.getElementById('nightModeBtn');
  if (btn) btn.innerText = isNight ? '☀️ Day' : '🌙 Night';
}

function toggleNightMode() {
  const isNight = localStorage.getItem('nightMode') === '1';
  localStorage.setItem('nightMode', isNight ? '0' : '1');
  applyNightMode();
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', applyNightMode);
connectSocket();
loadOrders();
setInterval(loadOrders, 60000);