window.SOCKET_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;
window.API_URL = `${window.SOCKET_URL}/api`;

let orders = [];
let socket = null;
let soundEnabled = true;
let audioCtx = null;

// ---------- SOUND ----------
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playBeep() {
  if (!soundEnabled) return;

  try {
    initAudio();

    // 3 short beeps
    [0, 0.18, 0.36].forEach((startAt) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'square';
      osc.frequency.value = 900;

      const t = audioCtx.currentTime + startAt;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch (e) {
    console.log('Beep error:', e);
  }
}

// Browser autoplay policy: enable sound after first click
document.addEventListener(
  'click',
  () => {
    initAudio();
  },
  { once: true }
);

const soundToggle = document.getElementById('soundToggle');
const soundLabel = document.getElementById('soundLabel');

soundToggle.addEventListener('change', (e) => {
  soundEnabled = e.target.checked;
  soundLabel.innerText = soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF';
  if (soundEnabled) {
    initAudio();
    playBeep(); // test beep
  }
});

// ---------- SOCKET ----------
function setConnectionStatus(online, text) {
  const el = document.getElementById('connectionStatus');
  el.innerHTML = `<span class="dot ${online ? 'online' : 'offline'}"></span> ${text}`;
}

function connectSocket() {
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
  });

  socket.on('connect', () => {
    setConnectionStatus(true, 'Live');
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false, 'Offline');
  });

  socket.on('connect_error', (err) => {
    console.log('Socket error:', err.message);
    setConnectionStatus(false, 'Server offline');
  });

  socket.on('newOrder', (order) => {
    console.log('🆕 New order:', order.orderNumber);
    playBeep();

    if (!['new', 'preparing', 'ready'].includes(order.status)) return;

    const idx = orders.findIndex((o) => o._id === order._id);
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);

    renderBoard(order._id);
  });

  socket.on('orderUpdated', (order) => {
    console.log('🔄 Updated:', order.orderNumber, order.status);

    if (['completed', 'cancelled'].includes(order.status)) {
      orders = orders.filter((o) => o._id !== order._id);
    } else if (['new', 'preparing', 'ready'].includes(order.status)) {
      const idx = orders.findIndex((o) => o._id === order._id);
      if (idx >= 0) orders[idx] = order;
      else orders.unshift(order);
    }
    renderBoard();
  });
}

// ---------- LOAD ----------
async function loadKitchenOrders() {
  try {
    const res = await fetch(`${API_URL}/orders?today=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Failed to load orders');

    const data = await res.json();
    orders = data.filter((o) => ['new', 'preparing', 'ready'].includes(o.status));
    renderBoard();
  } catch (err) {
    console.error(err);
    document.getElementById('colNew').innerHTML =
      '<div class="empty-col">⚠️ Backend not connected<br><small>Check npm run dev</small></div>';
  }
}

// ---------- RENDER ----------
function getElapsed(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBoard(flashId = null) {
  const newOrders = orders.filter((o) => o.status === 'new');
  const prepOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  document.getElementById('countNew').innerText = newOrders.length;
  document.getElementById('countPreparing').innerText = prepOrders.length;
  document.getElementById('countReady').innerText = readyOrders.length;
  document.getElementById('badgeNew').innerText = newOrders.length;
  document.getElementById('badgePreparing').innerText = prepOrders.length;
  document.getElementById('badgeReady').innerText = readyOrders.length;

  document.getElementById('colNew').innerHTML = renderCards(newOrders, flashId);
  document.getElementById('colPreparing').innerHTML = renderCards(prepOrders, flashId);
  document.getElementById('colReady').innerHTML = renderCards(readyOrders, flashId);
}

function renderCards(list, flashId) {
  if (!list.length) {
    return '<div class="empty-col">No orders</div>';
  }

  return list
    .map((o) => {
      const elapsed = getElapsed(o.createdAt);
      const timeStr = new Date(o.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const typeIcon =
        o.orderType === 'delivery' ? '🚚' : o.orderType === 'dine-in' ? '🪑' : '🥡';

      const itemsHtml = (o.items || [])
        .map((item) => {
          const name = item.product?.name || item.productName || 'Item';
          const details = [];

          if (item.size) details.push(String(item.size).toUpperCase());
          if (item.crust?.name) details.push(item.crust.name);
          if (Array.isArray(item.addons)) {
            item.addons.forEach((a) => {
              if (a?.name) details.push(a.name);
              else if (typeof a === 'string') details.push(a);
            });
          }
          if (item.specialInstructions) details.push('⚠ ' + item.specialInstructions);

          return `
            <div class="k-item-row">
              <div class="k-qty">${item.qty}x</div>
              <div class="k-item-info">
                <div class="k-item-name">${escapeHtml(name)}</div>
                ${
                  details.length
                    ? `<div class="k-item-meta">${escapeHtml(details.join(' • '))}</div>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      let actionBtn = '';
      if (o.status === 'new') {
        actionBtn = `<button class="btn-start" onclick="updateStatus('${o._id}', 'preparing')">▶ START COOKING</button>`;
      } else if (o.status === 'preparing') {
        actionBtn = `<button class="btn-ready" onclick="updateStatus('${o._id}', 'ready')">✓ MARK READY</button>`;
      } else if (o.status === 'ready') {
        actionBtn = `<button class="btn-done" onclick="updateStatus('${o._id}', 'completed')">✅ COMPLETED</button>`;
      }

      const lateClass = elapsed >= 15 ? 'late' : elapsed >= 10 ? 'warn' : '';
      const flashClass = flashId === o._id ? 'flash' : '';
      const custName = o.customer?.name && o.customer.name !== 'Guest' ? o.customer.name : '';
      const custPhone =
        o.customer?.phone && o.customer.phone !== 'N/A' ? o.customer.phone : '';

      return `
        <div class="k-card status-${o.status} ${flashClass}">
          <div class="k-card-top">
            <div>
              <div class="k-order-no">${escapeHtml(o.orderNumber)}</div>
              <div class="k-type-pill ${o.orderType}">${typeIcon} ${escapeHtml(
        (o.orderType || '').toUpperCase()
      )}</div>
            </div>
            <div class="k-time-box">
              <div class="k-clock">${timeStr}</div>
              <div class="k-timer ${lateClass}">⏱ ${elapsed} min</div>
            </div>
          </div>

          ${
            custName || custPhone
              ? `<div class="k-customer">👤 ${escapeHtml(custName)}${
                  custName && custPhone ? ' · ' : ''
                }${escapeHtml(custPhone)}</div>`
              : ''
          }

          ${
            o.deliveryAddress
              ? `<div class="k-address">📍 ${escapeHtml(o.deliveryAddress)}</div>`
              : ''
          }

          <div class="k-items">${itemsHtml}</div>

          <div class="k-footer">
            <div class="k-total">₹${o.grandTotal || 0}</div>
            <div class="k-pay">${escapeHtml((o.paymentMethod || '').toUpperCase())}</div>
          </div>

          <div class="k-actions">${actionBtn}</div>
        </div>
      `;
    })
    .join('');
}

// ---------- STATUS ----------
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
    if (['completed', 'cancelled'].includes(order.status)) {
      orders = orders.filter((o) => o._id !== order._id);
    } else {
      orders = orders.map((o) => (o._id === order._id ? order : o));
    }
    renderBoard();
  } catch (err) {
    alert(err.message);
  }
}

// timers
setInterval(() => renderBoard(), 30000);
setInterval(loadKitchenOrders, 60000);
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

// page load
document.addEventListener('DOMContentLoaded', applyNightMode);
applyNightMode();

// init
connectSocket();
loadKitchenOrders();