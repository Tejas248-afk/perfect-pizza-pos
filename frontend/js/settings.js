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
// Only admin / super-admin
if (user && !['super-admin', 'admin'].includes(user.role)) {
  alert('Only Admin can access Settings');
  window.location.href = 'pos.html';
}

let settingsData = null;
let staffList = [];
let editingStaffId = null;

// ---------- TABS ----------
function switchSettingsTab(tab) {
  document.querySelectorAll('.st-tab').forEach((b) => b.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  document.getElementById('tab-cafe').classList.add('hidden');
  document.getElementById('tab-rewards').classList.add('hidden');
  document.getElementById('tab-staff').classList.add('hidden');
  document.getElementById('tab-' + tab).classList.remove('hidden');

  if (tab === 'staff') loadStaff();
}

// ---------- LOAD SETTINGS ----------
async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load settings');
    settingsData = await res.json();
    fillCafeForm(settingsData);
    fillRewardsForm(settingsData);
  } catch (err) {
    alert(err.message);
  }
}

function fillCafeForm(s) {
  document.getElementById('cafeName').value = s.cafeName || '';
  document.getElementById('tagline').value = s.tagline || '';
  document.getElementById('address').value = s.address || '';
  document.getElementById('phone').value = s.phone || '';
  document.getElementById('whatsapp').value = s.whatsapp || '';
  document.getElementById('gstNumber').value = s.gstNumber || '';
  document.getElementById('email').value = s.email || '';
  document.getElementById('website').value = s.website || '';
  document.getElementById('workingHours').value = s.workingHours || '';
  document.getElementById('invoicePrefix').value = s.invoicePrefix || '';
  document.getElementById('footerText').value = s.footerText || '';
  document.getElementById('defaultGST').value = s.defaultGST ?? 5;
  document.getElementById('gstDefaultOn').checked = !!s.gstDefaultOn;
}

function fillRewardsForm(s) {
  document.getElementById('rewardThreshold').value = s.rewardThreshold ?? 100;
  document.getElementById('earnAboveHundred').value = s.earnAboveHundred ?? 20;
  document.getElementById('earnBelowOrEqualHundred').value = s.earnBelowOrEqualHundred ?? 10;
  document.getElementById('coinsPerRedeemBlock').value = s.coinsPerRedeemBlock ?? 20;
  document.getElementById('redeemBlockValue').value = s.redeemBlockValue ?? 5;
  updateRewardPreview();
}

function updateRewardPreview() {
  const coins = document.getElementById('coinsPerRedeemBlock').value || 20;
  const val = document.getElementById('redeemBlockValue').value || 5;
  const above = document.getElementById('earnAboveHundred').value || 20;
  const below = document.getElementById('earnBelowOrEqualHundred').value || 10;
  const th = document.getElementById('rewardThreshold').value || 100;
  document.getElementById('rewardPreview').innerText =
    `Earn: >₹${th} → ${above} coins, ≤₹${th} → ${below} coins  |  Redeem: ${coins} coins = ₹${val}`;
}

['rewardThreshold', 'earnAboveHundred', 'earnBelowOrEqualHundred', 'coinsPerRedeemBlock', 'redeemBlockValue']
  .forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateRewardPreview);
  });

// ---------- SAVE CAFE ----------
async function saveCafeSettings(e) {
  e.preventDefault();
  const payload = {
    cafeName: document.getElementById('cafeName').value.trim(),
    tagline: document.getElementById('tagline').value.trim(),
    address: document.getElementById('address').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
    gstNumber: document.getElementById('gstNumber').value.trim(),
    email: document.getElementById('email').value.trim(),
    website: document.getElementById('website').value.trim(),
    workingHours: document.getElementById('workingHours').value.trim(),
    invoicePrefix: document.getElementById('invoicePrefix').value.trim(),
    footerText: document.getElementById('footerText').value.trim(),
    defaultGST: Number(document.getElementById('defaultGST').value) || 5,
    gstDefaultOn: document.getElementById('gstDefaultOn').checked,
  };

  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Save failed');
    alert('✅ Café settings saved');
    settingsData = data.settings;
  } catch (err) {
    alert(err.message);
  }
}

// ---------- SAVE REWARDS ----------
async function saveRewardSettings(e) {
  e.preventDefault();
  const payload = {
    rewardThreshold: Number(document.getElementById('rewardThreshold').value) || 100,
    earnAboveHundred: Number(document.getElementById('earnAboveHundred').value) || 20,
    earnBelowOrEqualHundred: Number(document.getElementById('earnBelowOrEqualHundred').value) || 10,
    coinsPerRedeemBlock: Number(document.getElementById('coinsPerRedeemBlock').value) || 20,
    redeemBlockValue: Number(document.getElementById('redeemBlockValue').value) || 5,
  };

  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Save failed');
    alert('✅ Reward rules saved');
    settingsData = data.settings;
  } catch (err) {
    alert(err.message);
  }
}

// ---------- STAFF ----------
async function loadStaff() {
  const tbody = document.getElementById('staffBody');
  tbody.innerHTML = `<tr><td colspan="5" class="empty">Loading...</td></tr>`;
  try {
    const res = await fetch(`${API_URL}/settings/staff`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load staff');
    staffList = await res.json();
    renderStaff();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">${err.message}</td></tr>`;
  }
}

function renderStaff() {
  const tbody = document.getElementById('staffBody');
  if (!staffList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No staff found</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList
    .map((s) => {
      const canEdit = !(s.role === 'super-admin' && user.role !== 'super-admin');
      return `
      <tr>
        <td><b>${escapeHtml(s.name)}</b></td>
        <td>${escapeHtml(s.phone)}</td>
        <td><span class="role-pill ${s.role}">${s.role}</span></td>
        <td class="${s.isActive ? 'status-on' : 'status-off'}">${s.isActive ? 'Active' : 'Inactive'}</td>
        <td>
          ${
            canEdit
              ? `<button class="btn-mini edit" onclick='openStaffModal(${JSON.stringify(s)})'>Edit</button>`
              : ''
          }
          ${
            s.role !== 'super-admin' && String(s._id) !== String(user._id)
              ? `<button class="btn-mini del" onclick="deleteStaff('${s._id}')">Delete</button>`
              : ''
          }
        </td>
      </tr>`;
    })
    .join('');
}

function openStaffModal(staff = null) {
  editingStaffId = staff ? staff._id : null;
  document.getElementById('staffModalTitle').innerText = staff ? 'Edit Staff' : 'Add Staff';
  document.getElementById('staffId').value = staff ? staff._id : '';
  document.getElementById('staffName').value = staff ? staff.name : '';
  document.getElementById('staffPhone').value = staff ? staff.phone : '';
  document.getElementById('staffPhone').disabled = !!staff; // phone locked on edit
  document.getElementById('staffEmail').value = staff ? staff.email || '' : '';
  document.getElementById('staffRole').value = staff ? staff.role : 'cashier';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffPassLabel').innerText = staff
    ? 'New Password (leave blank to keep)'
    : 'Password *';
  document.getElementById('staffPassword').required = !staff;
  document.getElementById('staffActiveWrap').style.display = staff ? 'block' : 'none';
  document.getElementById('staffActive').checked = staff ? !!staff.isActive : true;

  // Hide admin option for non super-admin
  const roleSelect = document.getElementById('staffRole');
  [...roleSelect.options].forEach((opt) => {
    if (opt.value === 'admin' || opt.value === 'super-admin') {
      opt.hidden = user.role !== 'super-admin';
    }
  });

  document.getElementById('staffModal').style.display = 'flex';
}

function closeStaffModal() {
  document.getElementById('staffModal').style.display = 'none';
  editingStaffId = null;
}

async function saveStaff(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staffName').value.trim(),
    phone: document.getElementById('staffPhone').value.trim(),
    email: document.getElementById('staffEmail').value.trim(),
    role: document.getElementById('staffRole').value,
  };

  const pass = document.getElementById('staffPassword').value.trim();
  if (!editingStaffId) {
    if (!pass || pass.length < 4) return alert('Password min 4 characters');
    payload.password = pass;
  } else if (pass) {
    payload.password = pass;
    payload.isActive = document.getElementById('staffActive').checked;
  } else {
    payload.isActive = document.getElementById('staffActive').checked;
  }

  try {
    const url = editingStaffId
      ? `${API_URL}/settings/staff/${editingStaffId}`
      : `${API_URL}/settings/staff`;
    const method = editingStaffId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Save failed');

    closeStaffModal();
    loadStaff();
    alert('✅ Staff saved');
  } catch (err) {
    alert(err.message);
  }
}

async function deleteStaff(id) {
  if (!confirm('Delete this staff account?')) return;
  try {
    const res = await fetch(`${API_URL}/settings/staff/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Delete failed');
    loadStaff();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
// init
loadSettings();