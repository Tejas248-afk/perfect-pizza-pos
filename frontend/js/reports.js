// 🔥 APNA RENDER BACKEND URL YAHAN LIKHO (Bina aakhiri slash '/')
const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; 

window.SOCKET_URL = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
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
  if (adminPages.some(page => currentPage.includes(page))) {
    alert('⛔ Access Denied: Only Admins can view this page.');
    window.location.href = 'pos.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (user && user.role === 'cashier') {
    document.querySelectorAll('a[href="menu-manager.html"], a[href="reports.html"], a[href="settings.html"]').forEach(btn => {
      btn.style.display = 'none';
    });
  }
  const userNameEl = document.getElementById('userName');
  if (userNameEl && user) userNameEl.innerText = `👤 ${user.name} (${user.role})`;
});
// ------------------------------------

function setFilter(type, event) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  } else if (type === 'today') {
    // If reset is clicked, activate today button
    document.querySelector('.btn-preset[onclick*="today"]').classList.add('active');
  }

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

  const startEl = document.getElementById('startDate');
  const endEl = document.getElementById('endDate');
  if (startEl) startEl.value = formatDate(start);
  if (endEl) endEl.value = formatDate(end);

  fetchReports();
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function fetchReports() {
  const startDateEl = document.getElementById('startDate');
  const endDateEl = document.getElementById('endDate');
  
  if (!startDateEl || !endDateEl) return;
  
  const startDate = startDateEl.value;
  const endDate = endDateEl.value;

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
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  // 1. KPIs
  setTxt('valTotalSales', `₹${(data.totalSales || 0).toFixed(2)}`);
  setTxt('valTotalOrders', data.totalOrders || 0);
  setTxt('valAvgOrder', `Avg: ₹${(data.averageOrderValue || 0).toFixed(2)} / order`);
  setTxt('valGst', `₹${(data.totalGst || 0).toFixed(2)}`);
  
  // NEW: Cancelled KPI
  setTxt('valCancelledAmount', `₹${(data.totalCancelledAmount || 0).toFixed(2)}`);
  setTxt('valCancelledOrders', `${data.totalCancelledOrders || 0} Orders Cancelled`);

  // 2. Payment Breakdown
  setTxt('valUpi', `₹${(data.paymentSplit?.upi || 0).toFixed(2)}`);
  setTxt('valCash', `₹${(data.paymentSplit?.cash || 0).toFixed(2)}`);
  setTxt('valCard', `₹${(data.paymentSplit?.card || 0).toFixed(2)}`);

  // 3. Order Type Breakdown
  setTxt('valTypeDelivery', `${data.orderTypeSplit?.delivery || 0} orders`);
  setTxt('valTypeTakeaway', `${data.orderTypeSplit?.takeaway || 0} orders`);
  setTxt('valTypeDinein', `${data.orderTypeSplit?.['dine-in'] || 0} orders`);

  // 4. NEW: Daily Summary Table (From Screenshot)
  const dailyBody = document.getElementById('dailySummaryBody');
  if (dailyBody) {
    if (!data.dailyBreakdown || data.dailyBreakdown.length === 0) {
      dailyBody.innerHTML = '<tr><td colspan="7" class="text-center">No sales data for selected period</td></tr>';
    } else {
      dailyBody.innerHTML = data.dailyBreakdown.map(day => `
        <tr>
          <td><b>${day.date}</b></td>
          <td><span style="background:#10b981; color:white; padding:2px 8px; border-radius:12px; font-size:12px;">${day.orders}</span></td>
          <td>₹${(day.subTotal || 0).toFixed(2)}</td>
          <td>₹${(day.tax || 0).toFixed(2)}</td>
          <td>₹${(day.grossSales || 0).toFixed(2)}</td>
          <td class="text-danger">₹${(day.cancelledAmount || 0).toFixed(2)}</td>
          <td class="text-success">₹${(day.netSales || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // 5. Top Products Table
  const tbody = document.getElementById('topProductsBody');
  if (!tbody) return;

  if (!data.topProducts || data.topProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No sales recorded for this period</td></tr>';
    return;
  }

  tbody.innerHTML = data.topProducts.map((p, idx) => `
    <tr>
      <td><b>#${idx + 1}</b></td>
      <td><b>${p.name}</b></td>
      <td>${p.qty} pcs</td>
      <td style="color:#06A94D; font-weight:700;">₹${p.revenue.toFixed(2)}</td>
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
setFilter('today', null);