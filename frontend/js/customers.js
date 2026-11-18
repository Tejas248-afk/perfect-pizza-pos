const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com";

const isLocal = 
  window.location.protocol === 'file:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '';

window.SOCKET_URL = isLocal ? 'http://localhost:5000' : RENDER_BACKEND_URL;
window.API_URL = `${window.SOCKET_URL}/api`;
const API_URL = window.API_URL;

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

let currentPage = 1;
let totalPages = 1;
let searchTimeout = null;
let currentSearch = '';

document.addEventListener('DOMContentLoaded', () => {
  loadCustomers();
});

async function loadCustomers() {
  const tbody = document.getElementById('customerTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">⏳ Loading customer records...</td></tr>';

  try {
    const url = `${API_URL}/customers?page=${currentPage}&limit=50&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}: Failed to fetch customers`);
    }

    const data = await res.json();
    totalPages = data.pages || 1;

    // Render Stats
    if (data.stats) {
      const statCust = document.getElementById('kpiTotalCustomers');
      const statSpent = document.getElementById('kpiTotalSpent');
      const statCoins = document.getElementById('kpiTotalCoins');
      const statOrders = document.getElementById('kpiTotalOrders');
      
      if (statCust) statCust.innerText = Number(data.total || 0).toLocaleString('en-IN');
      if (statSpent) statSpent.innerText = `₹${Number(data.stats.totalSpentAll || 0).toLocaleString('en-IN')}`;
      if (statCoins) statCoins.innerText = Number(data.stats.totalCoinsAll || 0).toLocaleString('en-IN');
      if (statOrders) statOrders.innerText = Number(data.stats.totalOrdersAll || 0).toLocaleString('en-IN');
    }

    renderTable(data.customers || []);
    updatePagination(data.total || 0, data.customers ? data.customers.length : 0);
  } catch (err) {
    console.error("loadCustomers Error:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px;"><strong>Error:</strong> ${err.message}<br><small style="color:#64748B;">Please ensure server is running</small></td></tr>`;
  }
}

function renderTable(customers) {
  const tbody = document.getElementById('customerTableBody');
  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color:#64748B;">No customer records found.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map((c, idx) => `
    <tr>
      <td><strong>${escapeHtml(c.name && c.name.toLowerCase() !== 'guest' ? c.name : 'Guest Customer')}</strong></td>
      <td><span style="font-weight:600; color:#1E40AF;">📞 ${escapeHtml(c.phone || '-')}</span></td>
      <td><span style="color:#475569; font-size:13px;">${escapeHtml(c.address || '—')}</span></td>
      <td><span class="badge-coin">🪙 ${c.rewardCoins || 0}</span></td>
      <td>📦 ${c.totalOrders || 0}</td>
      <td><strong>₹${Number(c.totalSpent || 0).toLocaleString('en-IN')}</strong></td>
      <td style="text-align: right;">
        <button class="btn-sm btn-edit" onclick="openEditModal('${c._id}', '${escapeQuotes(c.name)}', '${escapeQuotes(c.phone)}', '${escapeQuotes(c.address)}', ${c.rewardCoins || 0})">✏️ Edit</button>
        <button class="btn-sm btn-del" onclick="deleteCustomer('${c._id}', '${escapeQuotes(c.name)}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function updatePagination(total, currentCount) {
  const start = total > 0 ? (currentPage - 1) * 50 + 1 : 0;
  const end = (currentPage - 1) * 50 + currentCount;
  document.getElementById('pageStats').innerText = total > 0 ? `Showing ${start}-${end} of ${total} customers` : 'Showing 0 customers';
  document.getElementById('pageIndicator').innerText = `Page ${currentPage} of ${totalPages}`;

  document.getElementById('prevBtn').disabled = currentPage <= 1;
  document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function changePage(delta) {
  currentPage += delta;
  loadCustomers();
}

function onSearchChange() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearch = document.getElementById('searchInput').value.trim();
    currentPage = 1;
    loadCustomers();
  }, 300);
}

function openAddModal() {
  document.getElementById('modalTitle').innerText = 'Add New Customer';
  document.getElementById('custId').value = '';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custAddress').value = '';
  document.getElementById('custCoins').value = '0';
  document.getElementById('custModal').classList.add('active');
}

function openEditModal(id, name, phone, address, coins) {
  document.getElementById('modalTitle').innerText = 'Edit Customer Record';
  document.getElementById('custId').value = id;
  document.getElementById('custName').value = name || '';
  document.getElementById('custPhone').value = phone || '';
  document.getElementById('custAddress').value = address || '';
  document.getElementById('custCoins').value = coins || 0;
  document.getElementById('custModal').classList.add('active');
}

function closeModal() {
  document.getElementById('custModal').classList.remove('active');
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('custId').value;
  const name = document.getElementById('custName').value;
  const phone = document.getElementById('custPhone').value;
  const address = document.getElementById('custAddress').value;
  const rewardCoins = document.getElementById('custCoins').value;

  const payload = { name, phone, address, rewardCoins };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_URL}/customers/${id}` : `${API_URL}/customers`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save customer');

    alert(id ? 'Customer updated successfully! ✅' : 'Customer added successfully! ✅');
    closeModal();
    loadCustomers();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteCustomer(id, name) {
  if (!confirm(`Are you sure you want to delete customer "${name}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to delete customer');

    alert('Customer deleted successfully!');
    loadCustomers();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function exportToCSV() {
  try {
    const url = `${API_URL}/customers?exportAll=true&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to fetch data for export');

    const data = await res.json();
    const customers = data.customers || [];

    if (customers.length === 0) {
      alert('No data to export!');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Name,Phone,Address,Reward Coins,Total Orders,Total Spent (INR)\n";

    customers.forEach(c => {
      const name = `"${(c.name || 'Guest').replace(/"/g, '""')}"`;
      const phone = `"${(c.phone || '').replace(/"/g, '""')}"`;
      const address = `"${(c.address || '').replace(/"/g, '""')}"`;
      csvContent += `${name},${phone},${address},${c.rewardCoins || 0},${c.totalOrders || 0},${c.totalSpent || 0}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `perfect_pizza_customers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    alert('Export Error: ' + err.message);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeQuotes(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}