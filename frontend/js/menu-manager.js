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

let fullMenu = { categories: [], products: [], crusts: [], addons: [] };
let activeTab = 'products';
let currentEditId = null;

// ---------- LOAD ----------
async function loadMenu() {
  try {
    const res = await fetch(`${API_URL}/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch menu');
    fullMenu = await res.json();
    renderTable();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- TABS ----------
function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  const titles = {
    products: '🍕 Products / Combos / Burgers / Prices',
    categories: '📁 Categories',
    crusts: '🍞 Crusts (Extra Charges)',
    addons: '🧀 Add-ons / Extras',
  };
  document.getElementById('currentTabTitle').innerText = titles[tabName];
  renderTable();
}

// ---------- TABLE ----------
function renderTable() {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');

  if (activeTab === 'products') {
    thead.innerHTML = `
      <tr>
        <th style="width:22%">Product / Combo</th>
        <th style="width:14%">Category</th>
        <th style="width:28%">Details / Combo Contents</th>
        <th style="width:18%">Prices</th>
        <th style="width:8%">Status</th>
        <th style="width:10%">Actions</th>
      </tr>`;

    if (!fullMenu.products.length) {
      tbody.innerHTML = emptyRow(6);
      return;
    }

    tbody.innerHTML = fullMenu.products
      .map((p) => {
        const cat = fullMenu.categories.find((c) => c._id === p.category);
        const priceStr = p.hasSizes
          ? `<div class="price-pill">R ₹${p.prices?.regular || 0}</div>
             <div class="price-pill">M ₹${p.prices?.medium || 0}</div>
             <div class="price-pill">L ₹${p.prices?.large || 0}</div>`
          : `<div class="price-pill single">₹${p.prices?.single || 0}</div>`;

        const flags = [
          p.hasSizes ? 'Sizes' : 'Fixed',
          p.hasCrust ? 'Crust' : null,
          p.hasAddons ? 'Addons' : null,
          p.isSpicy ? '🌶️' : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return `
          <tr>
            <td>
              <div class="item-title">${escapeHtml(p.name)} ${p.isSpicy ? '🌶️' : ''}</div>
              <div class="item-sub">${flags}</div>
            </td>
            <td>${cat ? escapeHtml(cat.icon + ' ' + cat.name) : '-'}</td>
            <td><div class="desc-cell">${escapeHtml(p.description || '—')}</div></td>
            <td><div class="price-wrap">${priceStr}</div></td>
            <td>
              <button class="status-btn ${p.isAvailable ? 'on' : 'off'}" onclick="toggleAvail('${p._id}')">
                ${p.isAvailable ? 'ON' : 'OFF'}
              </button>
            </td>
            <td class="actions-cell">
              <button class="btn-edit" onclick='openModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
              <button class="btn-delete" onclick="deleteItem('${p._id}')">Del</button>
            </td>
          </tr>`;
      })
      .join('');
  }

  else if (activeTab === 'categories') {
    thead.innerHTML = `<tr><th>Icon</th><th>Category</th><th>Order</th><th>Items Count</th><th>Actions</th></tr>`;
    if (!fullMenu.categories.length) {
      tbody.innerHTML = emptyRow(5);
      return;
    }
    tbody.innerHTML = fullMenu.categories
      .map((c) => {
        const count = fullMenu.products.filter((p) => p.category === c._id).length;
        return `
          <tr>
            <td style="font-size:22px">${c.icon || '📁'}</td>
            <td><b>${escapeHtml(c.name)}</b></td>
            <td>${c.displayOrder ?? 0}</td>
            <td>${count} items</td>
            <td class="actions-cell">
              <button class="btn-edit" onclick='openModal(${JSON.stringify(c)})'>Edit</button>
              <button class="btn-delete" onclick="deleteItem('${c._id}')">Del</button>
            </td>
          </tr>`;
      })
      .join('');
  }

  else if (activeTab === 'crusts') {
    thead.innerHTML = `<tr><th>Crust Name</th><th>Regular Extra</th><th>Medium Extra</th><th>Actions</th></tr>`;
    if (!fullMenu.crusts.length) {
      tbody.innerHTML = emptyRow(4);
      return;
    }
    tbody.innerHTML = fullMenu.crusts
      .map(
        (c) => `
      <tr>
        <td><b>${escapeHtml(c.name)}</b></td>
        <td>₹${c.extraPrice?.regular ?? 0}</td>
        <td>₹${c.extraPrice?.medium ?? 0}</td>
        <td class="actions-cell">
          <button class="btn-edit" onclick='openModal(${JSON.stringify(c)})'>Edit</button>
          <button class="btn-delete" onclick="deleteItem('${c._id}')">Del</button>
        </td>
      </tr>`
      )
      .join('');
  }

  else if (activeTab === 'addons') {
    thead.innerHTML = `<tr><th>Add-on Name</th><th>Regular</th><th>Medium</th><th>Large</th><th>Actions</th></tr>`;
    if (!fullMenu.addons.length) {
      tbody.innerHTML = emptyRow(5);
      return;
    }
    tbody.innerHTML = fullMenu.addons
      .map(
        (a) => `
      <tr>
        <td><b>${escapeHtml(a.name)}</b></td>
        <td>₹${a.prices?.regular ?? 0}</td>
        <td>₹${a.prices?.medium ?? 0}</td>
        <td>₹${a.prices?.large ?? 0}</td>
        <td class="actions-cell">
          <button class="btn-edit" onclick='openModal(${JSON.stringify(a)})'>Edit</button>
          <button class="btn-delete" onclick="deleteItem('${a._id}')">Del</button>
        </td>
      </tr>`
      )
      .join('');
  }
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="empty">No items yet. Click <b>+ Add New Item</b></td></tr>`;
}

// ---------- MODAL ----------
function openModal(item = null) {
  currentEditId = item ? item._id : null;
  document.getElementById('modalTitle').innerText = item
    ? `✏️ Edit ${labelTab()}`
    : `➕ Add New ${labelTab()}`;

  const body = document.getElementById('modalFormBody');

  // ===== PRODUCTS / COMBOS =====
  if (activeTab === 'products') {
    if (!fullMenu.categories.length) {
      alert('Pehle ek Category banao (Categories tab), phir product add karo.');
      return;
    }

    const catOptions = fullMenu.categories
      .map(
        (c) =>
          `<option value="${c._id}" ${item && item.category === c._id ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>`
      )
      .join('');

    const hasSizes = item ? !!item.hasSizes : true;

    body.innerHTML = `
      <div class="form-section-title">Basic Info</div>

      <div class="form-group">
        <label>Product / Combo Name *</label>
        <input type="text" id="fName" value="${item ? escapeAttr(item.name) : ''}" required placeholder="e.g. Cheese Paneer Pizza / Meal For 2">
      </div>

      <div class="form-group">
        <label>Category *</label>
        <select id="fCat" required>${catOptions}</select>
      </div>

      <div class="form-group">
        <label>Description / Combo Contents *</label>
        <textarea id="fDesc" rows="3" placeholder="Example: 2 Single Topping Pizza + Garlic Bread + ColdDrink 250ml">${item ? escapeHtml(item.description || '') : ''}</textarea>
        <div class="hint">Combos ke liye yahan poora detail likho — kitchen aur bill me ye dikhega.</div>
      </div>

      <div class="form-section-title">Pricing</div>

      <div class="form-group">
        <label class="check-line">
          <input type="checkbox" id="fHasSizes" ${hasSizes ? 'checked' : ''} onchange="toggleSizeInputs()">
          Has sizes? (Regular / Medium / Large) — pizzas ke liye ON rakho
        </label>
      </div>

      <div id="priceSizes" class="price-grid" style="display:${hasSizes ? 'grid' : 'none'}">
        <div class="form-group">
          <label>Regular ₹</label>
          <input type="number" id="pReg" min="0" step="1" value="${item?.prices?.regular ?? 0}">
        </div>
        <div class="form-group">
          <label>Medium ₹</label>
          <input type="number" id="pMed" min="0" step="1" value="${item?.prices?.medium ?? 0}">
        </div>
        <div class="form-group">
          <label>Large ₹</label>
          <input type="number" id="pLrg" min="0" step="1" value="${item?.prices?.large ?? 0}">
        </div>
      </div>

      <div id="priceSingle" class="form-group" style="display:${hasSizes ? 'none' : 'block'}">
        <label>Fixed Price ₹ (Burger / Maggi / Combo / Sides)</label>
        <input type="number" id="pSingle" min="0" step="1" value="${item?.prices?.single ?? 0}">
      </div>

      <div class="form-section-title">Options</div>

      <div class="checks-grid">
        <label class="check-line"><input type="checkbox" id="fCrust" ${item?.hasCrust ? 'checked' : ''}> Allow Crust selection</label>
        <label class="check-line"><input type="checkbox" id="fAddon" ${item?.hasAddons ? 'checked' : ''}> Allow Add-ons</label>
        <label class="check-line"><input type="checkbox" id="fSpicy" ${item?.isSpicy ? 'checked' : ''}> Spicy item 🌶️</label>
        <label class="check-line"><input type="checkbox" id="fAvailable" ${!item || item.isAvailable !== false ? 'checked' : ''}> Available for sale</label>
      </div>

      <div class="form-group" style="margin-top:12px">
        <label>Display Order (optional)</label>
        <input type="number" id="fOrder" value="${item?.displayOrder ?? 0}" min="0">
      </div>
    `;
  }

  // ===== CATEGORIES =====
  else if (activeTab === 'categories') {
    body.innerHTML = `
      <div class="form-group">
        <label>Category Name *</label>
        <input type="text" id="fName" value="${item ? escapeAttr(item.name) : ''}" required placeholder="e.g. Super Saving Combos">
      </div>
      <div class="form-group">
        <label>Icon (emoji)</label>
        <input type="text" id="fIcon" value="${item ? escapeAttr(item.icon || '🍕') : '🎁'}" placeholder="🍕 🍔 🎁">
      </div>
      <div class="form-group">
        <label>Display Order</label>
        <input type="number" id="fOrder" value="${item?.displayOrder ?? 0}" min="0">
        <div class="hint">Chhota number pehle dikhega (1, 2, 3...)</div>
      </div>
    `;
  }

  // ===== CRUSTS =====
  else if (activeTab === 'crusts') {
    body.innerHTML = `
      <div class="form-group">
        <label>Crust Name *</label>
        <input type="text" id="fName" value="${item ? escapeAttr(item.name) : ''}" required placeholder="e.g. Cheese Burst">
      </div>
      <div class="form-section-title">Extra Charge by Size</div>
      <div class="price-grid two">
        <div class="form-group">
          <label>Regular Extra ₹</label>
          <input type="number" id="cReg" min="0" value="${item?.extraPrice?.regular ?? 0}">
        </div>
        <div class="form-group">
          <label>Medium Extra ₹</label>
          <input type="number" id="cMed" min="0" value="${item?.extraPrice?.medium ?? 0}">
        </div>
      </div>
      <div class="hint">Classic / free crust add karne ki zarurat nahi — POS me default free hota hai.</div>
    `;
  }

  // ===== ADDONS =====
  else if (activeTab === 'addons') {
    body.innerHTML = `
      <div class="form-group">
        <label>Add-on Name *</label>
        <input type="text" id="fName" value="${item ? escapeAttr(item.name) : ''}" required placeholder="e.g. Extra Cheese">
      </div>
      <div class="form-section-title">Price by Pizza Size</div>
      <div class="price-grid">
        <div class="form-group">
          <label>Regular ₹</label>
          <input type="number" id="aReg" min="0" value="${item?.prices?.regular ?? 0}">
        </div>
        <div class="form-group">
          <label>Medium ₹</label>
          <input type="number" id="aMed" min="0" value="${item?.prices?.medium ?? 0}">
        </div>
        <div class="form-group">
          <label>Large ₹</label>
          <input type="number" id="aLrg" min="0" value="${item?.prices?.large ?? 0}">
        </div>
      </div>
    `;
  }

  const modal = document.getElementById('editModal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function toggleSizeInputs() {
  const hasSizes = document.getElementById('fHasSizes').checked;
  document.getElementById('priceSizes').style.display = hasSizes ? 'grid' : 'none';
  document.getElementById('priceSingle').style.display = hasSizes ? 'none' : 'block';
}

function closeModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function labelTab() {
  return (
    {
      products: 'Product / Combo',
      categories: 'Category',
      crusts: 'Crust',
      addons: 'Add-on',
    }[activeTab] || 'Item'
  );
}

// ---------- SAVE ----------
async function saveItem(e) {
  e.preventDefault();
  let payload = {};

  if (activeTab === 'products') {
    const hasSizes = document.getElementById('fHasSizes').checked;
    payload = {
      name: document.getElementById('fName').value.trim(),
      category: document.getElementById('fCat').value,
      description: document.getElementById('fDesc').value.trim(),
      hasSizes,
      prices: hasSizes
        ? {
            regular: num('pReg'),
            medium: num('pMed'),
            large: num('pLrg'),
            single: 0,
          }
        : {
            regular: 0,
            medium: 0,
            large: 0,
            single: num('pSingle'),
          },
      hasCrust: document.getElementById('fCrust').checked,
      hasAddons: document.getElementById('fAddon').checked,
      isSpicy: document.getElementById('fSpicy').checked,
      isAvailable: document.getElementById('fAvailable').checked,
      displayOrder: num('fOrder'),
    };

    if (!payload.name) return alert('Name required');
    if (hasSizes && payload.prices.regular <= 0 && payload.prices.medium <= 0 && payload.prices.large <= 0) {
      return alert('Kam se kam ek size price daalo');
    }
    if (!hasSizes && payload.prices.single <= 0) {
      return alert('Fixed price daalo');
    }
  } else if (activeTab === 'categories') {
    payload = {
      name: document.getElementById('fName').value.trim(),
      icon: document.getElementById('fIcon').value.trim() || '📁',
      displayOrder: num('fOrder'),
    };
  } else if (activeTab === 'crusts') {
    payload = {
      name: document.getElementById('fName').value.trim(),
      extraPrice: { regular: num('cReg'), medium: num('cMed') },
    };
  } else if (activeTab === 'addons') {
    payload = {
      name: document.getElementById('fName').value.trim(),
      prices: { regular: num('aReg'), medium: num('aMed'), large: num('aLrg') },
    };
  }

  const method = currentEditId ? 'PUT' : 'POST';
  const url = currentEditId
    ? `${API_URL}/menu/${activeTab}/${currentEditId}`
    : `${API_URL}/menu/${activeTab}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Save failed');

    closeModal();
    await loadMenu();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- DELETE ----------
async function deleteItem(id) {
  if (!confirm('Delete permanently? Ye undo nahi hoga.')) return;
  try {
    const res = await fetch(`${API_URL}/menu/${activeTab}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Delete failed');
    await loadMenu();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- TOGGLE AVAIL ----------
async function toggleAvail(id) {
  try {
    const res = await fetch(`${API_URL}/menu/products/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Toggle failed');
    await loadMenu();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- HELPERS ----------
function num(id) {
  return Number(document.getElementById(id)?.value) || 0;
}
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
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
loadMenu();