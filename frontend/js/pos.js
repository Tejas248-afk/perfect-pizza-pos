// --- URLs & CONFIGURATION (DEPLOYMENT READY) ---
// 🔥 APNA RENDER BACKEND URL YAHAN DALEIN (Bina aakhiri slash '/')
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
  if (adminPages.some((page) => currentPage.includes(page))) {
    alert('⛔ Access Denied: Only Admins can view this page.');
    window.location.href = 'pos.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (user.role === 'cashier') {
    document
      .querySelectorAll('a[href="menu-manager.html"], a[href="reports.html"], a[href="settings.html"]')
      .forEach((btn) => {
        btn.style.display = 'none';
      });
  }
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.innerText = `👤 ${user.name} (${user.role})`;
});

// ------------------------------------
// --- Global State ---
let menuData = { categories: [], products: [], crusts: [], addons: [] };
let currentCategory = null;
let cart = [];
let modalState = {
  product: null,
  qty: 1,
  size: 'regular',
  crustId: null,
  addons: [],
  comboSelections: [],
};
let currentCustomer = null;

// --- Table / Dine-in State ---
const urlParams = new URLSearchParams(window.location.search);
const posMode = urlParams.get('mode');
const selectedTableId = localStorage.getItem('selectedTableId');
const selectedTableName = localStorage.getItem('selectedTableName');
const runningOrderId = localStorage.getItem('runningOrderId');
const runningTableId = localStorage.getItem('runningTableId');
const runningTableName = localStorage.getItem('runningTableName');

let existingOrderData = null;

// --- 1. Init UI & Menu ---
function initPOS() {
  if (posMode === 'dine-in' || posMode === 'add-kot') {
    const tableName = posMode === 'dine-in' ? selectedTableName : runningTableName;
    document.getElementById('branchName').innerText = `(${tableName})`;

    const dineInRadio = document.querySelector('input[value="dine-in"]');
    if (dineInRadio) dineInRadio.checked = true;
    document.querySelectorAll('input[name="orderType"]').forEach((r) => (r.disabled = true));

    if (posMode === 'dine-in') {
      document.getElementById('payBtn').innerText = '👨‍🍳 START TABLE & SEND KOT';
      document.getElementById('paymentMethod').disabled = true;
    } else if (posMode === 'add-kot') {
      document.getElementById('payBtn').innerText = '👨‍🍳 ADD ITEMS (SEND KOT)';
      document.getElementById('clearTableBtn').style.display = 'block';
      document.getElementById('paymentMethod').disabled = false;
      loadExistingOrder();
    }
  }

  toggleDeliveryFields();
  fetchMenu();
}

async function fetchMenu() {
  try {
    const res = await fetch(`${API_URL}/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    menuData = await res.json();
    renderCategories();
  } catch (error) {
    alert('Error loading menu. Please check backend connection.');
  }
}

function renderCategories() {
  const container = document.getElementById('categoriesList');
  if (!container) return;
  container.innerHTML = '';

  menuData.categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = `category-btn ${index === 0 ? 'active' : ''}`;
    btn.innerHTML = `<span>${cat.icon}</span> ${cat.name}`;
    btn.onclick = () => {
      document.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(cat._id);
    };
    container.appendChild(btn);

    if (index === 0) renderProducts(cat._id);
  });
}

function renderProducts(categoryId, searchQuery = '') {
  currentCategory = categoryId;
  const container = document.getElementById('productsGrid');
  if (!container) return;
  container.innerHTML = '';

  const q = (searchQuery || '').trim().toLowerCase();

  let products = menuData.products.filter((p) => {
    const catOk = q ? true : p.category === categoryId;
    if (!catOk) return false;

    if (!q) return true;

    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
    return name.includes(q) || desc.includes(q) || tags.includes(q);
  });

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:#94A3B8; font-weight:600;">
        ${q ? `No products found for “${searchQuery}”` : 'No products in this category'}
      </div>`;
    return;
  }

  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    let displayPrice = p.hasSizes ? p.prices.regular : p.prices.single;

    let tagsHtml = '';
    if (p.tags && p.tags.length > 0) {
      tagsHtml = `<div style="display:flex; gap:5px; margin-bottom:8px; flex-wrap:wrap;">
        ${p.tags
          .map(
            (t) =>
              `<span style="background:#FEF08A; color:#92400E; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; text-transform:uppercase;">${t}</span>`
          )
          .join('')}
      </div>`;
    }

    let imgHtml = '';
    if (p.image) {
      imgHtml = `<img src="${p.image}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:10px;" alt="${p.name}">`;
    }

    let vegIcon = p.isVeg !== false ? '🟩' : '🟥';

    card.innerHTML = `
      <div>
        ${imgHtml}
        ${tagsHtml}
        <h4>${vegIcon} ${p.name} ${p.isSpicy ? '<span class="tag-spicy">🌶️</span>' : ''}</h4>
        ${
          p.description
            ? `<p style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${p.description}</p>`
            : ''
        }
      </div>
      <div class="price">₹${displayPrice} ${
      p.hasSizes ? '<small style="font-size:10px; color:#64748B;">onwards</small>' : ''
    }</div>
    `;

    card.onclick = () => openModal(p);
    container.appendChild(card);
  });
}

// --- 2. Customer Lookup (Name + Address Auto Fill) ---
let lookupTimer = null;
document.getElementById('customerPhone')?.addEventListener('input', (e) => {
  const phone = e.target.value.trim();
  clearTimeout(lookupTimer);

  if (phone.length < 10) {
    resetCustomerInfo();
    return;
  }
  lookupTimer = setTimeout(() => searchCustomer(phone), 300);
});

function manualCustomerSearch() {
  const phone = document.getElementById('customerPhone')?.value.trim();
  if (phone && phone.length === 10) searchCustomer(phone);
  else alert('Please enter a valid 10-digit phone number');
}

async function searchCustomer(phone) {
  try {
    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);

    const res = await fetch(`${API_URL}/orders/customer/${cleanPhone}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const card = document.getElementById('customerCard');

    if (!data.found) {
      resetCustomerInfo();
      return;
    }

    currentCustomer = data;
    const c = data.customer || {};

    const nameInput = document.getElementById('customerName');
    const addrInput = document.getElementById('customerAddress');

    if (nameInput) nameInput.value = c.name || '';
    if (addrInput) {
      addrInput.value = c.address || c.deliveryAddress || '';
      if ((c.address || c.deliveryAddress || '').trim() !== '') {
        addrInput.style.display = 'block';
      }
    }

    document.getElementById('ccName').innerText = c.name || 'Customer';
    document.getElementById('ccPhone').innerText = c.phone || cleanPhone;
    document.getElementById('ccCoins').innerText = c.rewardCoins || 0;
    document.getElementById('ccOrders').innerText = c.totalOrders || 0;
    document.getElementById('ccSpent').innerText = c.totalSpent || 0;

    const prevBox = document.getElementById('ccPrevOrders');
    if (!data.previousOrders || data.previousOrders.length === 0) {
      prevBox.innerHTML = '<div class="cc-prev-empty">No previous orders found</div>';
    } else {
      prevBox.innerHTML = data.previousOrders
        .map((o) => {
          const d = new Date(o.createdAt).toLocaleDateString('en-IN');
          return `<div class="cc-prev-item"><span><b>${o.orderNumber}</b> (${o.orderType})</span><span>₹${o.grandTotal} · ${d}</span></div>`;
        })
        .join('');
    }

    card.classList.remove('hidden');

    const redeemToggle = document.getElementById('redeemCoinsToggle');
    if (redeemToggle) {
      const canRedeem = (c.rewardCoins || 0) >= 20;
      redeemToggle.disabled = !canRedeem;
    }
    document.getElementById('availableCoinsText').innerText = c.rewardCoins || 0;
    calculateTotals();
  } catch (err) {
    console.error('Customer lookup error:', err);
  }
}

function resetCustomerInfo() {
  currentCustomer = null;
  document.getElementById('customerCard')?.classList.add('hidden');
  const prevBox = document.getElementById('ccPrevOrders');
  if(prevBox) prevBox.innerHTML = '';

  const nameInput = document.getElementById('customerName');
  const addrInput = document.getElementById('customerAddress');
  if (nameInput) nameInput.value = '';
  if (addrInput) addrInput.value = '';

  const toggle = document.getElementById('redeemCoinsToggle');
  if (toggle) {
    toggle.checked = false;
    toggle.disabled = true;
  }
  const availText = document.getElementById('availableCoinsText');
  if(availText) availText.innerText = '0';
  calculateTotals();
}

// --- 3. Customization Modal ---
function openModal(product) {
  modalState = {
    product,
    qty: 1,
    size: 'regular',
    crustId: null,
    addons: [],
    comboSelections: [],
  };

  if (!product.hasSizes && !product.hasCrust && !product.hasAddons && !product.isCombo) {
    addToCartDirect(product);
    return;
  }

  document.getElementById('modalItemName').innerText = product.name;
  const body = document.getElementById('modalBody');
  body.innerHTML = '';

  if (product.isCombo && product.comboChoices && product.comboChoices.length > 0) {
    let comboHTML = `<div class="modal-section" style="background:#EFF6FF; padding:12px; border-radius:8px; border:1px solid #BFDBFE; margin-bottom:15px;">`;
    comboHTML += `<h4 style="color:#1E3A8A; margin:0 0 10px 0; font-size:14px;">Combo Selections</h4>`;

    product.comboChoices.forEach((choice, index) => {
      comboHTML += `<div style="margin-bottom:10px;">
        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:4px; color:#334155;">${choice.title}</label>
        <select class="combo-select" data-index="${index}" style="width:100%; padding:8px; font-size:13px; border:1px solid #CBD5E1; border-radius:6px; outline:none;">
          ${choice.options.map((opt) => `<option value="${opt}">${opt}</option>`).join('')}
        </select>
      </div>`;
    });
    comboHTML += `</div>`;
    body.innerHTML += comboHTML;
  }

  if (product.hasSizes) {
    let sizeHTML = `<div class="modal-section radio-group"><h4>Select Size</h4>`;
    ['regular', 'medium', 'large'].forEach((s) => {
      if (product.prices[s] > 0) {
        sizeHTML += `<label><input type="radio" name="size" value="${s}" ${
          s === 'regular' ? 'checked' : ''
        } onchange="updateModalState('size', '${s}')"> ${
          s.charAt(0).toUpperCase() + s.slice(1)
        } (₹${product.prices[s]})</label>`;
      }
    });
    sizeHTML += `</div>`;
    body.innerHTML += sizeHTML;
  }

  if (product.hasCrust) {
    let crustHTML = `<div class="modal-section radio-group"><h4>Select Crust</h4>`;
    crustHTML += `<label><input type="radio" name="crust" value="null" checked onchange="updateModalState('crust', null)"> Classic Hand Tossed (Free)</label>`;
    menuData.crusts.forEach((c) => {
      crustHTML += `<label><input type="radio" name="crust" value="${c._id}" onchange="updateModalState('crust', '${c._id}')"> ${c.name} (+₹<span class="crust-price" data-id="${c._id}">0</span>)</label>`;
    });
    crustHTML += `</div>`;
    body.innerHTML += crustHTML;
  }

  if (product.hasAddons) {
    let addonHTML = `<div class="modal-section checkbox-group"><h4>Add-ons</h4>`;
    menuData.addons.forEach((a) => {
      addonHTML += `<label><input type="checkbox" value="${a._id}" onchange="toggleAddon('${a._id}', this.checked)"> ${a.name} (+₹<span class="addon-price" data-id="${a._id}">0</span>)</label>`;
    });
    addonHTML += `</div>`;
    body.innerHTML += addonHTML;
  }

  document.getElementById('modalQty').innerText = 1;
  document.getElementById('itemModal').classList.remove('hidden');
  updateModalPrice();
}

function closeModal() {
  document.getElementById('itemModal').classList.add('hidden');
}

function updateModalState(key, value) {
  modalState[key] = value;
  updateModalPrice();
}

function toggleAddon(id, isChecked) {
  if (isChecked) modalState.addons.push(id);
  else modalState.addons = modalState.addons.filter((a) => a !== id);
  updateModalPrice();
}

function updateModalQty(change) {
  const newQty = modalState.qty + change;
  if (newQty >= 1) {
    modalState.qty = newQty;
    document.getElementById('modalQty').innerText = modalState.qty;
    updateModalPrice();
  }
}

function updateModalPrice() {
  const { product, size, crustId, addons, qty } = modalState;
  let basePrice = product.hasSizes ? product.prices[size] : product.prices.single;

  let crustPrice = 0;
  if (product.hasCrust) {
    menuData.crusts.forEach((c) => {
      let p = c.extraPrice[size] || 0;
      let el = document.querySelector(`.crust-price[data-id="${c._id}"]`);
      if (el) el.innerText = p;
      if (crustId === c._id) crustPrice = p;
    });
  }

  let addonsTotal = 0;
  if (product.hasAddons) {
    menuData.addons.forEach((a) => {
      let p = a.prices[size] || a.prices.regular;
      let el = document.querySelector(`.addon-price[data-id="${a._id}"]`);
      if (el) el.innerText = p;
      if (addons.includes(a._id)) addonsTotal += p;
    });
  }

  const unitPrice = basePrice + crustPrice + addonsTotal;
  document.getElementById('modalPrice').innerText = `₹${unitPrice * qty}`;
}

// --- 4. Cart Management ---
function addToCartDirect(product) {
  cart.push({
    product,
    size: null,
    crust: null,
    addons: [],
    qty: 1,
    basePrice: product.prices.single,
    crustPrice: 0,
    addonsTotal: 0,
    comboSelections: [],
  });
  renderCart();
}

function addToCart() {
  const { product, size, crustId, addons, qty } = modalState;

  let comboSelections = [];
  if (product.isCombo) {
    document.querySelectorAll('.combo-select').forEach((select) => {
      const title = product.comboChoices[select.dataset.index].title;
      comboSelections.push(`${title}: ${select.value}`);
    });
  }

  let crustObj = crustId ? menuData.crusts.find((c) => c._id === crustId) : null;
  let addonsList = addons.map((id) => menuData.addons.find((a) => a._id === id));

  let basePrice = product.hasSizes ? product.prices[size] : product.prices.single;
  let crustPrice = crustObj ? crustObj.extraPrice[size] || 0 : 0;
  let addonsTotal = 0;
  addonsList.forEach((a) => (addonsTotal += a.prices[size] || a.prices.regular));

  cart.push({
    product,
    size,
    crust: crustObj,
    addons: addonsList,
    qty,
    basePrice,
    crustPrice,
    addonsTotal,
    comboSelections,
  });

  closeModal();
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if(!container) return;
  container.innerHTML = '';

  const countEl = document.getElementById('cartItemCount');
  if (countEl) countEl.innerText = `${cart.length} items`;

  if (cart.length === 0) {
    container.innerHTML = `<div class="empty-cart">
      <span style="font-size:40px; margin-bottom:10px; display:block;">🛒</span>
      Cart is empty
    </div>`;
  } else {
    cart.forEach((item, index) => {
      let unitPrice = item.basePrice + (item.crustPrice || 0) + (item.addonsTotal || 0);
      let desc = [];
      if (item.size) desc.push(item.size.charAt(0).toUpperCase() + item.size.slice(1));
      if (item.crust) desc.push(item.crust.name);
      item.addons.forEach((a) => desc.push(a.name));
      if (item.comboSelections) item.comboSelections.forEach((cs) => desc.push(cs));

      container.innerHTML += `
        <div class="cart-item">
          <div class="cart-item-header">
            <span>${item.product.name}</span>
            <span>₹${unitPrice * item.qty}</span>
          </div>
          <div class="cart-item-details" style="color:#1E40AF; font-weight:500;">${desc.join('<br>')}</div>
          <div class="cart-item-actions">
            <div class="qty-control">
              <button onclick="updateCartQty(${index}, -1)">-</button>
              <span>${item.qty}</span>
              <button onclick="updateCartQty(${index}, 1)">+</button>
            </div>
            <button onclick="removeCartItem(${index})">🗑️ Remove</button>
          </div>
        </div>
      `;
    });
  }
  calculateTotals();
}

function updateCartQty(index, change) {
  cart[index].qty += change;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  renderCart();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  renderCart();
}

// --- 5. Table Existing Order Loader ---
async function loadExistingOrder() {
  try {
    const res = await fetch(`${API_URL}/orders/${runningOrderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    existingOrderData = await res.json();

    const list = document.getElementById('existingItemsList');
    document.getElementById('existingItemsContainer').style.display = 'block';

    list.innerHTML = existingOrderData.items
      .map((i) => {
        let desc = [];
        if (i.size) desc.push(i.size);
        if (i.crust?.name) desc.push(i.crust.name);
        if (i.comboSelections) desc.push(...i.comboSelections);
        const descText =
          desc.length > 0
            ? `<div style="font-size:10px; color:#64748B;">${desc.join(' | ')}</div>`
            : '';

        return `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; color:#475569;">
        <div><span>${i.qty}x ${i.product?.name || i.productName}</span>${descText}</div>
        <span>₹${(i.basePrice + (i.crustPrice || 0) + (i.addonsTotal || 0)) * i.qty}</span>
      </div>`;
      })
      .join('');

    if (existingOrderData.customer?.phone && existingOrderData.customer.phone !== 'N/A') {
      const phoneInput = document.getElementById('customerPhone');
      if(phoneInput) phoneInput.value = existingOrderData.customer.phone;
      searchCustomer(existingOrderData.customer.phone);
    }

    if (existingOrderData.discount) {
      const discInp = document.getElementById('discountInput');
      if(discInp) discInp.value = existingOrderData.discount;
    }
      
    if (existingOrderData.gstAmount > 0) {
      const gstTgl = document.getElementById('gstToggle');
      if(gstTgl) gstTgl.checked = true;
    }

    calculateTotals();
  } catch (err) {
    alert('Failed to load running order!');
  }
}

// --- 6. Calculation Logic ---
function toggleDeliveryFields() {
  const orderTypeNode = document.querySelector('input[name="orderType"]:checked');
  const orderType = orderTypeNode ? orderTypeNode.value : 'dine-in';

  const addressInput = document.getElementById('customerAddress');
  const deliveryRow = document.getElementById('deliveryRow');
  const deliveryInput = document.getElementById('deliveryChargeInput');

  if (addressInput && deliveryRow && deliveryInput) {
    if (orderType === 'delivery') {
      addressInput.style.display = 'block';
      deliveryRow.style.display = 'flex';
      deliveryInput.disabled = false;
    } else {
      deliveryRow.style.display = 'none';
      deliveryInput.value = '0';
      deliveryInput.disabled = true;
      if (!addressInput.value) addressInput.style.display = 'none';
    }
  }
  calculateTotals();
}

function calculateTotals() {
  let cartSubtotal = 0;
  cart.forEach((item) => {
    cartSubtotal +=
      (item.basePrice + (item.crustPrice || 0) + (item.addonsTotal || 0)) * item.qty;
  });

  let existingSubtotal = 0;
  if (existingOrderData && existingOrderData.items) {
    existingOrderData.items.forEach((item) => {
      existingSubtotal +=
        (item.basePrice + (item.crustPrice || 0) + (item.addonsTotal || 0)) * item.qty;
    });
  }

  let totalSubtotal = cartSubtotal + existingSubtotal;
  let discount = Number(document.getElementById('discountInput')?.value) || 0;

  let coinsDiscount = 0;
  let coinsToUse = 0;
  const redeemToggle = document.getElementById('redeemCoinsToggle');

  if (redeemToggle && redeemToggle.checked && currentCustomer) {
    const available = currentCustomer.customer.rewardCoins || 0;
    coinsToUse = Math.floor(available / 20) * 20;
    coinsDiscount = (coinsToUse / 20) * 5;

    const maxAllowed = Math.max(totalSubtotal - discount, 0);
    if (coinsDiscount > maxAllowed) {
      coinsToUse = Math.floor(maxAllowed / 5) * 20;
      coinsDiscount = (coinsToUse / 20) * 5;
    }
  }

  const cDiscText = document.getElementById('cartCoinsDiscount');
  if(cDiscText) cDiscText.innerText = `-₹${coinsDiscount}`;

  let serviceCharge = 0;
  const serviceInput = document.getElementById('serviceChargeInput');
  if (serviceInput) serviceCharge = Number(serviceInput.value) || 0;

  let deliveryCharge = 0;
  const deliveryInput = document.getElementById('deliveryChargeInput');
  if (deliveryInput && !deliveryInput.disabled) {
    deliveryCharge = Number(deliveryInput.value) || 0;
  }

  let taxableAmount = totalSubtotal - discount - coinsDiscount + serviceCharge;
  if (taxableAmount < 0) taxableAmount = 0;

  const gstTgl = document.getElementById('gstToggle');
  let isGstOn = gstTgl ? gstTgl.checked : false;
  let gstAmount = isGstOn ? taxableAmount * 0.05 : 0;

  let grandTotal = taxableAmount + deliveryCharge + gstAmount;

  const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
  setTxt('cartSubtotal', `₹${totalSubtotal}`);
  setTxt('cartGst', `₹${gstAmount.toFixed(2)}`);
  setTxt('cartTotal', `₹${Math.round(grandTotal)}`);

  window._rewardCoinsUsed = coinsToUse;
  window._rewardCoinsValue = coinsDiscount;

  syncFloatingCart();
}

document.getElementById('discountInput')?.addEventListener('input', calculateTotals);
const srvInput = document.getElementById('serviceChargeInput');
if (srvInput) srvInput.addEventListener('input', calculateTotals);
const delInput = document.getElementById('deliveryChargeInput');
if (delInput) delInput.addEventListener('input', calculateTotals);
document.getElementById('gstToggle')?.addEventListener('change', calculateTotals);
document.getElementById('redeemCoinsToggle')?.addEventListener('change', calculateTotals);
document
  .querySelectorAll('input[name="orderType"]')
  .forEach((r) => r.addEventListener('change', toggleDeliveryFields));

// --- 7. Pay / KOT Actions ---
document.getElementById('payBtn')?.addEventListener('click', async () => {
  if (cart.length === 0 && posMode !== 'add-kot') {
    alert('Cart is empty!');
    return;
  }

  const customerPhone = document.getElementById('customerPhone')?.value.trim() || '';
  const customerName = document.getElementById('customerName')?.value.trim() || '';
  const custAddrEl = document.getElementById('customerAddress');
  const customerAddress = custAddrEl ? custAddrEl.value.trim() : '';
  const orderTypeNode = document.querySelector('input[name="orderType"]:checked');
  const orderType = orderTypeNode ? orderTypeNode.value : 'dine-in';

  if (orderType === 'delivery') {
    if (!customerPhone) return alert('Phone number is required for Delivery!');
    if (!customerAddress) return alert('Address is required for Delivery!');
  }

  const orderData = {
    branch: 'Kalyanpur',
    orderType,
    customerPhone,
    customerName,
    deliveryAddress: posMode
      ? selectedTableName || runningTableName || 'Dine-in Table'
      : customerAddress,
    customerAddress: customerAddress,
    items: cart,
    subtotal: parseInt(document.getElementById('cartSubtotal')?.innerText.replace('₹', '') || 0),
    discount: Number(document.getElementById('discountInput')?.value) || 0,
    rewardCoinsUsed: window._rewardCoinsUsed || 0,
    rewardCoinsValue: window._rewardCoinsValue || 0,
    serviceCharge: document.getElementById('serviceChargeInput')
      ? Number(document.getElementById('serviceChargeInput').value)
      : 0,
    deliveryCharge: document.getElementById('deliveryChargeInput')
      ? Number(document.getElementById('deliveryChargeInput').value)
      : 0,
    gstAmount: parseFloat(document.getElementById('cartGst')?.innerText.replace('₹', '') || 0),
    grandTotal: parseInt(document.getElementById('cartTotal')?.innerText.replace('₹', '') || 0),
    paymentMethod: posMode ? 'pending' : (document.getElementById('paymentMethod')?.value || 'cash'),
  };

  const payBtn = document.getElementById('payBtn');
  payBtn.innerText = 'Processing...';
  payBtn.disabled = true;

  try {
    if (posMode === 'add-kot') {
      if (cart.length > 0) {
        await fetch(`${API_URL}/orders/${runningOrderId}/add-items`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderData),
        });
        alert('KOT Sent to Kitchen! 👨‍🍳');
      }
      window.location.href = 'tables.html';
    } else if (posMode === 'dine-in') {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();

      await fetch(`${API_URL}/tables/${selectedTableId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: data.order._id }),
      });

      alert('Table Started & KOT Sent! 👨‍🍳');
      window.location.href = 'tables.html';
    } else {
            // Order Success
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Order failed');

      // 1. Thermal Printer Bill Print
      generatePrintReceipt(data.order, data.customerData);
      window.print();

      // 2. Reset Cart & UI (Backend automatically sends WhatsApp message)
      cart = [];
      resetCustomerInfo();
      renderCart();

      document.querySelector('.cart-panel')?.classList.remove('open');
      document.getElementById('cartOverlay')?.classList.remove('open');
    }
    
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    payBtn.innerText = posMode
      ? posMode === 'dine-in'
        ? '👨‍🍳 START TABLE & SEND KOT'
        : '👨‍🍳 ADD ITEMS (SEND KOT)'
      : '💳 PAY & BILL';
    payBtn.disabled = false;
  }
});

// --- 8. Clear Table & Final Bill ---
const clearBtn = document.getElementById('clearTableBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    if (cart.length > 0)
      return alert("Please click 'ADD ITEMS' first to save new items before clearing the table!");

    const paymentMethod = document.getElementById('paymentMethod')?.value || 'cash';
    clearBtn.innerText = 'Printing...';
    clearBtn.disabled = true;

    try {
      const orderRes = await fetch(`${API_URL}/orders/${runningOrderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const finalOrder = await orderRes.json();
      finalOrder.paymentMethod = paymentMethod;

      generatePrintReceipt(finalOrder, currentCustomer ? currentCustomer.customer : null);
      window.print();

      await fetch(`${API_URL}/tables/${runningTableId}/clear`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethod }),
      });

      alert('Table Cleared & Bill Paid! ✅');
      window.location.href = 'tables.html';
    } catch (err) {
      alert(err.message);
      clearBtn.innerText = '🖨️ PRINT FINAL BILL & CLEAR TABLE';
      clearBtn.disabled = false;
    }
  });
}

// --- 9. Print Receipt Only ---
function generatePrintReceipt(order, customer) {
  const container = document.getElementById('printReceipt');
  if (!container) return;

  let itemsHtml = '';
  (order.items || []).forEach((item) => {
    const name = item.product?.name || item.productName || 'Item';
    const unit =
      (Number(item.basePrice) || 0) +
      (Number(item.crustPrice) || 0) +
      (Number(item.addonsTotal) || 0);
    const lineTotal = unit * (Number(item.qty) || 1);

    let extras = [];
    if (item.size) extras.push(String(item.size).toUpperCase());
    if (item.crust?.name) extras.push(item.crust.name);
    if (Array.isArray(item.addons))
      item.addons.forEach((a) => {
        if (a?.name) extras.push(a.name);
      });
    if (item.comboSelections) extras.push(...item.comboSelections);

    itemsHtml += `
      <div class="r-row">
        <div class="r-left">
          <div class="r-item">${item.qty} x ${name}</div>
          ${extras.length ? `<div class="r-extra">${extras.join(', ')}</div>` : ''}
        </div>
        <div class="r-right">₹${lineTotal}</div>
      </div>
    `;
  });

  const date = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const orderType = (order.orderType || '').toUpperCase();
  const payMethod = (order.paymentMethod || 'CASH').toUpperCase();
  const custName =
    order.customer?.name && order.customer.name !== 'Guest' ? order.customer.name : '';
  const custPhone =
    order.customer?.phone && order.customer.phone !== 'N/A' ? order.customer.phone : '';

  let tableLine = '';
  if (orderType === 'DINE-IN') {
    const tName = order.deliveryAddress || runningTableName || selectedTableName || '';
    if (tName) tableLine = `<div class="r-line"><b>Table:</b> ${tName}</div>`;
  }

  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const coinsVal = Number(order.rewardCoinsValue) || 0;
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
      ${tableLine}
      ${
        custName || custPhone
          ? `<div class="r-line"><b>Customer:</b> ${custName}${
              custName && custPhone ? ' | ' : ''
            }${custPhone}</div>`
          : ''
      }
      ${
        order.deliveryAddress && orderType === 'DELIVERY'
          ? `<div class="r-line"><b>Address:</b> ${order.deliveryAddress}</div>`
          : ''
      }
      <div class="r-dash"></div>
      <div class="r-row r-head"><div class="r-left"><b>ITEM</b></div><div class="r-right"><b>AMT</b></div></div>
      <div class="r-dash"></div>
      ${itemsHtml}
      <div class="r-dash"></div>
      <div class="r-row"><div class="r-left">Subtotal</div><div class="r-right">₹${subtotal}</div></div>
      ${
        discount > 0
          ? `<div class="r-row"><div class="r-left">Discount</div><div class="r-right">-₹${discount}</div></div>`
          : ''
      }
      ${
        coinsVal > 0
          ? `<div class="r-row"><div class="r-left">Coins Used</div><div class="r-right">-₹${coinsVal}</div></div>`
          : ''
      }
      ${
        service > 0
          ? `<div class="r-row"><div class="r-left">Service Charge</div><div class="r-right">+₹${service}</div></div>`
          : ''
      }
      ${
        delivery > 0
          ? `<div class="r-row"><div class="r-left">Delivery</div><div class="r-right">+₹${delivery}</div></div>`
          : ''
      }
      ${
        gst > 0
          ? `<div class="r-row"><div class="r-left">GST (5%)</div><div class="r-right">+₹${gst.toFixed(
              2
            )}</div></div>`
          : ''
      }
      <div class="r-dash"></div>
      <div class="r-row r-total"><div class="r-left"><b>TOTAL</b></div><div class="r-right"><b>₹${total}</b></div></div>
      <div class="r-row"><div class="r-left">Payment</div><div class="r-right">${payMethod}</div></div>
      ${
        order.rewardCoinsEarned
          ? `<div class="r-dash"></div><div class="r-center r-small">Coins Earned: +${
              order.rewardCoinsEarned
            }${
              customer?.rewardCoins != null
                ? `<br>Balance: ${customer.rewardCoins} Coins`
                : ''
            }</div>`
          : ''
      }
      <div class="r-dash"></div>
      <div class="r-center r-thanks">Thank You! Visit Again<br><span class="r-small">10 AM - 11 PM</span></div>
    </div>
  `;
}

// 🔥 INSTANT WHATSAPP SENDER (Rasta 1)
function sendWhatsAppBill(order) {
  if (!order) return;
  const phoneVal = order.customerPhone || order.customer?.phone;
  if (!phoneVal || phoneVal === 'N/A') return;

  const cleanPhone = String(phoneVal).replace(/[^0-9]/g, '').slice(-10);
  if (cleanPhone.length < 10) return;

  const name = order.customerName || order.customer?.name || 'Valued Customer';
  const dateObj = new Date(order.createdAt || Date.now());
  const date = dateObj.toLocaleDateString('en-IN');
  const time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const amount = order.grandTotal || 0;
  const orderType = (order.orderType || 'Takeaway').toUpperCase();
  const rewardPoints = order.rewardCoinsEarned || 0;
  const invoiceLink = `${window.location.origin}/track.html?id=${order._id}`;

  const message = `🙏 Thank You for Ordering from *Perfect Pizza!* 🍕

Dear *${name}*,
Your delicious order has been received! 🍕🛵
Thank you for choosing *Perfect Pizza*. ❤️

🧾 *Invoice Details*
━━━━━━━━━━━━━━
👤 *Customer:* ${name}
🧾 *Invoice No:* ${order.orderNumber}
📅 *Date:* ${date} ${time}

💰 *Total Payable:* ₹${amount}
✅ *Paid Amount:* ₹${amount}
🛵 *Order Type:* ${orderType}
🎁 *Reward Points Earned:* ${rewardPoints}
━━━━━━━━━━━━━━

🔥 *MORE SAVINGS ONLINE!* 🔥
🎟️ *Exclusive Online Discounts*
🍕 *Best Offers Every Day*
🎁 *Earn Reward Points*
💰 *Use Rewards on Future Orders*

🌐 *Order Online:* https://perfectpizzas.in/

🧾 *Track Your Order Live:*
${invoiceLink}

📞 *Contact:* 9889229198
📍 *Perfect Pizza*
Singhpur Chauraha, Bithoor Rd, Kalyanpur, Kanpur

✨ *Thanks again!*
🍕 *Hot, Fresh & Perfect Every Time!*`;

  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
  
  // Instant open WhatsApp
  window.open(whatsappUrl, '_blank');
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// =========================================
// SLIDE-OUT CART
// =========================================
function toggleCart() {
  document.querySelector('.cart-panel')?.classList.toggle('open');
  document.getElementById('cartOverlay')?.classList.toggle('open');
}

function syncFloatingCart() {
  const countEl = document.getElementById('cartItemCount');
  const totalEl = document.getElementById('cartTotal');

  if (countEl && totalEl) {
    const itemsCount = countEl.innerText.replace(/[^0-9]/g, '');
    const floatCount = document.getElementById('floatItemCount');
    const floatTotal = document.getElementById('floatTotal');
    if (floatCount) floatCount.innerText = itemsCount === '' ? '0' : itemsCount;

    const totalAmount = totalEl.innerText.replace(/[^0-9.]/g, '');
    if (floatTotal) floatTotal.innerText = totalAmount === '' ? '0' : totalAmount;
  }
}

// =========================================
// NIGHT MODE
// =========================================
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

// =========================================
// PRODUCT SEARCH BAR
// =========================================
function onProductSearch() {
  const input = document.getElementById('productSearch');
  const clearBtn = document.getElementById('clearSearchBtn');
  const q = input ? input.value : '';

  if (clearBtn) {
    clearBtn.classList.toggle('show', q.trim().length > 0);
  }

  if (q.trim()) {
    document.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
    renderProducts(currentCategory, q);
  } else {
    renderProducts(currentCategory || menuData.categories[0]?._id, '');
  }
}

function clearProductSearch() {
  const input = document.getElementById('productSearch');
  if (input) input.value = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.classList.remove('show');

  const firstCat = menuData.categories[0];
  if (firstCat) {
    document.querySelectorAll('.category-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    renderProducts(firstCat._id, '');
  } else {
    renderProducts(currentCategory, '');
  }
}

document.getElementById('productSearch')?.addEventListener('input', onProductSearch);

document.getElementById('productSearch')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const firstCard = document.querySelector('#productsGrid .product-card');
    if (firstCard) firstCard.click();
  }
});

// Start
document.addEventListener('DOMContentLoaded', applyNightMode);
initPOS();