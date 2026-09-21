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
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    setConnectionStatus(true, 'Live');
    console.log('✅ Orders page socket connected');
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false, 'Offline (Reconnecting...)');
    console.log('❌ Orders page socket disconnected');
  });

  socket.on('connect_error', (err) => {
    setConnectionStatus(false, 'Offline (Connecting...)');
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
async function loadOrders(silent = false) {
  const list = document.getElementById('ordersList');

  if (list && !silent && allOrders.length === 0) {
    list.innerHTML = '<div class="loading">Loading...</div>';
  }

  try {
    const res = await fetch(`${API_URL}/orders?today=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load orders');

    const newOrders = await res.json();

    if (silent && allOrders.length > 0) {
      const existingIds = new Set(allOrders.map((o) => o._id));
      const hasNew = newOrders.some((o) => !existingIds.has(o._id));
      if (hasNew) {
        playTripleBeep();
        flashPageTitle();
      }
    }

    allOrders = newOrders;
    renderOrders();
  } catch (err) {
    console.error('Fetch Error:', err.message);
    if (list && allOrders.length === 0) {
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

function getDeliveryAddress(order) {
  // Fail-safe: deliveryAddress OR customer.address style fields
  return (
    order.deliveryAddress ||
    order.customerAddress ||
    order.customer?.address ||
    order.address ||
    ''
  ).trim();
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

      const isDelivery = String(o.orderType || '').toLowerCase() === 'delivery';
      const address = getDeliveryAddress(o);

      const custPhone =
        o.customer?.phone && o.customer.phone !== 'N/A' ? ` · 📞 ${o.customer.phone}` : '';
      const custName = o.customer?.name ? ` · ${o.customer.name}` : '';

      // 🔥 Delivery address highlight box
      const addrHtml =
        isDelivery && address
          ? `<div class="order-address-box" style="margin-top:8px;padding:8px 10px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;font-size:13px;font-weight:600;color:#92400E;line-height:1.35;">
               📍 <b>DELIVER TO:</b><br>${address}
             </div>`
          : address
          ? `<div class="order-meta">📍 ${address}</div>`
          : isDelivery
          ? `<div class="order-meta" style="color:#dc2626;font-weight:600;">📍 Address missing</div>`
          : '';

      return `
        <div class="order-card" data-id="${o._id}">
          <div class="order-card-header">
            <h3>${o.orderNumber}</h3>
            <span class="badge ${o.status}">${o.status}</span>
          </div>
          <div class="order-meta">
            ${(o.orderType || '').toUpperCase()} · ${time}${custPhone}${custName}
          </div>
          ${addrHtml}
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

// ---------- Reprint (Bill + Delivery Address) ----------
async function reprintOrder(id) {
  try {
    let order = allOrders.find((o) => o._id === id);

    // Agar local me incomplete ho to server se full order lao
    if (!order || !order.items) {
      const res = await fetch(`${API_URL}/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch order');
      order = await res.json();
    }

    if (!order) return alert('Order not found');

    const container = document.getElementById('printReceipt');
    if (!container) return alert('Print container missing (#printReceipt)');

    let itemsHtml = (order.items || [])
      .map((item) => {
        const name = item.product?.name || item.productName || 'Item';
        const unit =
          (Number(item.basePrice) || 0) +
          (Number(item.crustPrice) || 0) +
          (Number(item.addonsTotal) || 0);

        let extras = [];
        if (item.size) extras.push(String(item.size).toUpperCase());
        if (item.crust?.name) extras.push(item.crust.name);
        if (Array.isArray(item.addons)) {
          item.addons.forEach((a) => a?.name && extras.push(a.name));
        }
        if (item.comboSelections) extras.push(...item.comboSelections);

        return `
        <div class="r-row">
          <div class="r-left">
            <div class="r-item">${item.qty} x ${name}</div>
            ${extras.length ? `<div class="r-extra">${extras.join(', ')}</div>` : ''}
          </div>
          <div class="r-right">₹${unit * (Number(item.qty) || 1)}</div>
        </div>
      `;
      })
      .join('');

    const date = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const orderType = String(order.orderType || '').toUpperCase();
    const isDelivery = orderType === 'DELIVERY';
    const address = getDeliveryAddress(order);

    const custName =
      order.customer?.name && order.customer.name !== 'Guest' ? order.customer.name : '';
    const custPhone =
      order.customer?.phone && order.customer.phone !== 'N/A' ? order.customer.phone : '';

    // 🔥 Delivery block for KOT/Bill
    const deliveryBlock =
      isDelivery
        ? `
        <div class="r-dash"></div>
        <div class="r-line"><b>CUSTOMER:</b> ${custName || 'Guest'}${custPhone ? ' | ' + custPhone : ''}</div>
        <div class="r-line" style="margin-top:4px;"><b>📍 DELIVERY ADDRESS:</b></div>
        <div class="r-line" style="font-weight:700; white-space:pre-wrap;">${address || 'Address not provided'}</div>
      `
        : `
        ${
          custName || custPhone
            ? `<div class="r-line"><b>Customer:</b> ${custName}${custName && custPhone ? ' | ' : ''}${custPhone}</div>`
            : ''
        }
      `;

    const subtotal = Number(order.subtotal) || 0;
    const discount = Number(order.discount) || 0;
    const service = Number(order.serviceCharge) || 0;
    const delivery = Number(order.deliveryCharge) || 0;
    const gst = Number(order.gstAmount) || 0;
    const total = Number(order.grandTotal) || 0;

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
        <div class="r-line"><b>Bill No:</b> ${order.orderNumber || '-'}</div>
        <div class="r-line"><b>Date:</b> ${date}</div>
        <div class="r-line"><b>Type:</b> ${orderType}</div>
        ${deliveryBlock}
        <div class="r-dash"></div>
        ${itemsHtml}
        <div class="r-dash"></div>
        ${subtotal ? `<div class="r-row"><div class="r-left">Subtotal</div><div class="r-right">₹${subtotal}</div></div>` : ''}
        ${discount > 0 ? `<div class="r-row"><div class="r-left">Discount</div><div class="r-right">-₹${discount}</div></div>` : ''}
        ${service > 0 ? `<div class="r-row"><div class="r-left">Service</div><div class="r-right">+₹${service}</div></div>` : ''}
        ${delivery > 0 ? `<div class="r-row"><div class="r-left">Delivery</div><div class="r-right">+₹${delivery}</div></div>` : ''}
        ${gst > 0 ? `<div class="r-row"><div class="r-left">GST</div><div class="r-right">+₹${gst.toFixed(2)}</div></div>` : ''}
        <div class="r-row r-total">
          <div class="r-left"><b>TOTAL</b></div>
          <div class="r-right"><b>₹${total}</b></div>
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
loadOrders(false);
setInterval(() => {
  loadOrders(true);
}, 10000);