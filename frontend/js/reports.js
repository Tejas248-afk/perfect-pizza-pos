window.SOCKET_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;
window.API_URL = `${window.SOCKET_URL}/api`;
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = 'index.html';
}

// --- SECURITY & ROLE ACCESS GUARD ---
const currentPage = window.location.pathname.split('/').pop();

// 1. Kitchen staff trying to access anything other than kitchen.html
if (user.role === 'kitchen' && !currentPage.includes('kitchen.html')) {
  window.location.href = 'kitchen.html'; 
}

// 2. Cashier trying to access Admin pages
if (user.role === 'cashier') {
  const adminPages = ['menu-manager.html', 'reports.html', 'settings.html'];
  if (adminPages.some(page => currentPage.includes(page))) {
    alert('⛔ Access Denied: Only Admins can view this page.');
    window.location.href = 'pos.html';
  }
}

// 3. Hide Admin Buttons from UI for Cashier
document.addEventListener('DOMContentLoaded', () => {
  if (user.role === 'cashier') {
    document.querySelectorAll('a[href="menu-manager.html"], a[href="reports.html"], a[href="settings.html"]').forEach(btn => {
      btn.style.display = 'none'; // Hide buttons
    });
  }
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.innerText = `👤 ${user.name} (${user.role})`;
});
// ------------------------------------

function setFilter(type) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const today = new Date();
  let start = new Date();
  let end = new Date();

  if (type === 'today') {
    // start & end are today
  } else if (type === 'yesterday') {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (type === 'thisWeek') {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - day + 1);
  } else if (type === 'thisMonth') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  document.getElementById('startDate').value = formatDate(start);
  document.getElementById('endDate').value = formatDate(end);

  fetchReports();
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function fetchReports() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  try {
    const res = await fetch(`${API_URL}/reports/summary?startDate=${startDate}&endDate=${endDate}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch report');

    const data = await res.json();
    renderReportData(data);

  } catch (err) {
    alert(err.message);
  }
}

function renderReportData(data) {
  // KPIs
  document.getElementById('valTotalSales').innerText = `₹${data.totalSales}`;
  document.getElementById('valTotalOrders').innerText = data.totalOrders;
  document.getElementById('valAvgOrder').innerText = `₹${data.averageOrderValue}`;
  document.getElementById('valGst').innerText = `₹${data.totalGst}`;

  // Payment Breakdown
  document.getElementById('valUpi').innerText = `₹${data.paymentSplit.upi || 0}`;
  document.getElementById('valCash').innerText = `₹${data.paymentSplit.cash || 0}`;
  document.getElementById('valCard').innerText = `₹${data.paymentSplit.card || 0}`;

  // Order Type Breakdown
  document.getElementById('valTypeDelivery').innerText = `${data.orderTypeSplit.delivery || 0} orders`;
  document.getElementById('valTypeTakeaway').innerText = `${data.orderTypeSplit.takeaway || 0} orders`;
  document.getElementById('valTypeDinein').innerText = `${data.orderTypeSplit['dine-in'] || 0} orders`;

  // Top Products Table
  const tbody = document.getElementById('topProductsBody');
  if (data.topProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No sales recorded for this period</td></tr>';
    return;
  }

  tbody.innerHTML = data.topProducts.map((p, idx) => `
    <tr>
      <td><b>#${idx + 1}</b></td>
      <td><b>${p.name}</b></td>
      <td>${p.qty} pcs</td>
      <td style="color:#06A94D; font-weight:700;">₹${p.revenue}</td>
    </tr>
  `).join('');
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
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

// page load
document.addEventListener('DOMContentLoaded', applyNightMode);
applyNightMode();

// Init default today
setFilter('today');