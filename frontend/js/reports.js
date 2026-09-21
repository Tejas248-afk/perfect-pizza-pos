const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com"; 

window.SOCKET_URL = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ? 'http://localhost:5000'
  : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;

const API_URL = window.API_URL;
let token = localStorage.getItem('token');
let user = null;

try {
  const userStr = localStorage.getItem('user');
  if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
} catch (e) { localStorage.clear(); }

if (!token || !user) {
  localStorage.clear();
  window.location.href = 'index.html';
}

if (user.role === 'cashier') {
  alert('⛔ Access Denied: Only Admins can view reports.');
  window.location.href = 'pos.html';
}

function getISTDateString(d = new Date()) {
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

function setPreset(type, event) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (type === 'all') {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    fetchReports();
    return;
  }

  if (type === 'today') {
    // today
  } else if (type === 'yesterday') {
    start.setDate(now.getDate() - 1);
    end.setDate(now.getDate() - 1);
  } else if (type === 'thisWeek') {
    const day = now.getDay() || 7;
    start.setDate(now.getDate() - day + 1);
  } else if (type === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  document.getElementById('startDate').value = getISTDateString(start);
  document.getElementById('endDate').value = getISTDateString(end);

  fetchReports();
}

document.addEventListener('DOMContentLoaded', () => {
  setPreset('all', null); // Initial load shows ALL orders so client sees data immediately!
});

async function fetchReports() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const tbody = document.getElementById('reportBody');
  const tfoot = document.getElementById('reportFoot');
  
  tbody.innerHTML = '<tr><td colspan="9" class="loader"><i class="fa-solid fa-spinner fa-spin"></i> Fetching data...</td></tr>';
  tfoot.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/reports/summary?startDate=${startDate}&endDate=${endDate}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch report');
    const data = await res.json();
    
    renderTable(data.dailyBreakdown || []);

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="9" style="color:red; text-align:center; padding:20px;">Error: ${err.message}</td></tr>`;
  }
}

function renderTable(dailyData) {
  const tbody = document.getElementById('reportBody');
  const tfoot = document.getElementById('reportFoot');

  if (dailyData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:25px; color:#64748b;">No orders found in database.</td></tr>';
    tfoot.style.display = 'none';
    return;
  }

  let html = '';
  let totals = { orders: 0, subTotal: 0, discount: 0, tax: 0, charges: 0, gross: 0, returns: 0, net: 0 };

  dailyData.forEach(day => {
    totals.orders += day.orders;
    totals.subTotal += day.subTotal;
    totals.discount += day.discount;
    totals.tax += day.tax;
    totals.charges += day.charges;
    totals.gross += day.grossSales;
    totals.returns += day.cancelledAmount;
    totals.net += day.netSales;

    html += `
      <tr class="data-row">
        <td><b>${day.date}</b></td>
        <td><span class="badge-orders">${day.orders}</span></td>
        <td>₹${day.subTotal.toFixed(2)}</td>
        <td class="val-discount">₹${day.discount.toFixed(2)}</td>
        <td>₹${day.tax.toFixed(2)}</td>
        <td>₹${day.charges.toFixed(2)}</td>
        <td>₹${day.grossSales.toFixed(2)}</td>
        <td class="val-returns">₹${day.cancelledAmount.toFixed(2)}</td>
        <td class="val-net">₹${day.netSales.toFixed(2)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  tfoot.innerHTML = `
    <tr>
      <td>TOTAL</td>
      <td><span class="badge-orders">${totals.orders}</span></td>
      <td>₹${totals.subTotal.toFixed(2)}</td>
      <td class="val-discount">₹${totals.discount.toFixed(2)}</td>
      <td>₹${totals.tax.toFixed(2)}</td>
      <td>₹${totals.charges.toFixed(2)}</td>
      <td>₹${totals.gross.toFixed(2)}</td>
      <td class="val-returns">₹${totals.returns.toFixed(2)}</td>
      <td class="val-net">₹${totals.net.toFixed(2)}</td>
    </tr>
  `;
  tfoot.style.display = 'table-footer-group';
}

function searchTable() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const rows = document.querySelectorAll(".data-row");

  rows.forEach(row => {
    const dateText = row.cells[0].innerText.toLowerCase();
    row.style.display = dateText.includes(input) ? "" : "none";
  });
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}