// ==============================
// ADVANCED REPORT SYSTEM (Orders API)
// ==============================

const RENDER_BACKEND_URL = "https://perfect-pizza-pos.onrender.com";

window.SOCKET_URL =
  window.location.origin.includes("localhost") ||
  window.location.origin.includes("127.0.0.1")
    ? "http://localhost:5000"
    : RENDER_BACKEND_URL;

window.API_URL = `${window.SOCKET_URL}/api`;

const API_URL = window.API_URL;
const token = localStorage.getItem("token");
let user = null;

try {
  const userStr = localStorage.getItem("user");
  if (userStr && userStr !== "undefined") user = JSON.parse(userStr);
} catch (e) {
  localStorage.clear();
}

if (!token || !user) {
  localStorage.clear();
  window.location.href = "index.html";
}

if (user.role === "cashier") {
  alert("⛔ Access Denied: Only Admins can view reports.");
  window.location.href = "pos.html";
}

let ALL_ORDERS = [];
let paymentChartInstance = null;
let hourlyChartInstance = null;

// ---------- helpers ----------
function pad(n) { return String(n).padStart(2, "0"); }

function toYMD(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function orderDayKey(order) {
  const d = new Date(order.createdAt || order.created_at || Date.now());
  if (isNaN(d.getTime())) return "unknown";
  return toYMD(d);
}

function orderDayLabel(order) {
  const d = new Date(order.createdAt || order.created_at || Date.now());
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isCancelled(order) {
  const s = String(order.status || "").toLowerCase().trim();
  return ["cancelled", "canceled", "cancel", "rejected"].includes(s);
}

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function money(n) { return `₹${num(n).toFixed(2)}`; }

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

// ---------- range presets ----------
function setRange(type, btn) {
  document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  else {
    const el = document.querySelector(`.btn-preset[data-range="${type}"]`);
    if (el) el.classList.add("active");
  }

  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (type === "today") {
    // today
  } else if (type === "yesterday") {
    start.setDate(now.getDate() - 1);
    end.setDate(now.getDate() - 1);
  } else if (type === "week") {
    const day = now.getDay() || 7;
    start.setDate(now.getDate() - day + 1);
  } else if (type === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (type === "all") {
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    buildReport();
    return;
  }

  document.getElementById("startDate").value = toYMD(start);
  document.getElementById("endDate").value = toYMD(end);
  buildReport();
}

// ---------- fetch orders ----------
async function fetchAllOrders() {
  const tbody = document.getElementById("reportBody");
  tbody.innerHTML = `<tr><td colspan="9" class="empty">⏳ Fetching all orders...</td></tr>`;

  const urls = [`${API_URL}/orders?limit=5000`, `${API_URL}/orders`, `${API_URL}/orders/all`];
  let orders = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      const data = await res.json();
      orders = Array.isArray(data) ? data : (data.orders || data.data || []);
      break;
    } catch (e) { console.error(e); }
  }

  ALL_ORDERS = orders || [];
  buildReport();
}

// ---------- Build Analytics & Reports ----------
function buildReport() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  let list = ALL_ORDERS.slice();
  if (start && end) {
    list = list.filter((o) => {
      const key = orderDayKey(o);
      return key >= start && key <= end;
    });
  }

  const map = {};
  
  // Analytics Data Objects
  let paymentData = { cash: 0, upi: 0, card: 0 };
  let hourlyData = new Array(24).fill(0);
  let topItemsMap = {};

  list.forEach((o) => {
    const key = orderDayKey(o);
    const label = orderDayLabel(o);
    if (!map[key]) {
      map[key] = { date: label, dateKey: key, orders: 0, subTotal: 0, discount: 0, tax: 0, charges: 0, grossSales: 0, cancelledAmount: 0, cancelledOrders: 0, netSales: 0 };
    }

    const day = map[key];
    const grand = num(o.grandTotal ?? o.totalAmount ?? o.total);
    const tax = num(o.gstAmount ?? o.tax ?? o.gst);
    const discount = num(o.discount);
    const charges = num(o.deliveryCharge ?? o.charges ?? o.packingCharge);
    const subTotal = num(o.subTotal) || Math.max(grand - tax - charges + discount, 0);

    if (isCancelled(o)) {
      day.cancelledOrders += 1;
      day.cancelledAmount += grand;
    } else {
      // 1. Valid Order Totals
      day.orders += 1;
      day.subTotal += subTotal;
      day.discount += discount;
      day.tax += tax;
      day.charges += charges;
      day.grossSales += grand;
      day.netSales += grand;

      // 2. Payment Split (Only Valid Orders)
      let pm = String(o.paymentMethod || "cash").toLowerCase().trim();
      if (pm === "online" || pm === "qr") pm = "upi";
      if (paymentData[pm] !== undefined) paymentData[pm] += grand;
      else paymentData.cash += grand; // default to cash

      // 3. Hourly Rush
      const d = new Date(o.createdAt || o.created_at || Date.now());
      if (!isNaN(d.getTime())) hourlyData[d.getHours()] += 1;

      // 4. Top Items
      (o.items || []).forEach(item => {
        const name = item.productName || item.product?.name || "Unknown Item";
        const qty = num(item.qty) || 1;
        const p = num(item.basePrice) + num(item.crustPrice) + num(item.addonsTotal);
        const rev = (p || num(item.price) || 0) * qty;

        if (!topItemsMap[name]) topItemsMap[name] = { qty: 0, rev: 0 };
        topItemsMap[name].qty += qty;
        topItemsMap[name].rev += rev;
      });
    }
  });

  const rows = Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  
  // Render Everything
  renderTableAndKPIs(rows);
  renderCharts(paymentData, hourlyData);
  renderTopItems(topItemsMap);
}

// ---------- RENDER FUNCTIONS ----------

function renderTableAndKPIs(rows) {
  const tbody = document.getElementById("reportBody");
  const tfoot = document.getElementById("reportFoot");

  let kNet = 0, kOrders = 0, kTax = 0, kCancel = 0, kCancelCount = 0;
  let html = "";
  let t = { orders: 0, subTotal: 0, discount: 0, tax: 0, charges: 0, gross: 0, returns: 0, net: 0 };

  rows.forEach((r) => {
    kNet += r.netSales; kOrders += r.orders; kTax += r.tax;
    kCancel += r.cancelledAmount; kCancelCount += r.cancelledOrders;

    t.orders += r.orders; t.subTotal += r.subTotal; t.discount += r.discount;
    t.tax += r.tax; t.charges += r.charges; t.gross += r.grossSales;
    t.returns += r.cancelledAmount; t.net += r.netSales;

    html += `<tr class="data-row">
        <td><b>${r.date}</b></td>
        <td><span class="badge">${r.orders}</span></td>
        <td>${money(r.subTotal)}</td>
        <td class="c-orange">${money(r.discount)}</td>
        <td>${money(r.tax)}</td>
        <td>${money(r.charges)}</td>
        <td>${money(r.grossSales)}</td>
        <td class="c-red">${money(r.cancelledAmount)}</td>
        <td class="c-blue">${money(r.netSales)}</td>
      </tr>`;
  });

  document.getElementById("kpiNet").innerText = money(kNet);
  document.getElementById("kpiOrders").innerText = kOrders;
  document.getElementById("kpiTax").innerText = money(kTax);
  document.getElementById("kpiCancel").innerText = `${money(kCancel)} (${kCancelCount})`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">No sales data found for selected period.</td></tr>`;
    tfoot.style.display = "none";
  } else {
    tbody.innerHTML = html;
    tfoot.innerHTML = `<tr>
      <td>TOTAL</td><td><span class="badge">${t.orders}</span></td><td>${money(t.subTotal)}</td>
      <td class="c-orange">${money(t.discount)}</td><td>${money(t.tax)}</td><td>${money(t.charges)}</td>
      <td>${money(t.gross)}</td><td class="c-red">${money(t.returns)}</td><td class="c-blue">${money(t.net)}</td>
    </tr>`;
    tfoot.style.display = "table-footer-group";
  }
}

function renderCharts(pay, hourly) {
  // Destroy old charts if exist
  if (paymentChartInstance) paymentChartInstance.destroy();
  if (hourlyChartInstance) hourlyChartInstance.destroy();

  // 1. Payment Pie Chart
  const ctxPay = document.getElementById('paymentChart').getContext('2d');
  paymentChartInstance = new Chart(ctxPay, {
    type: 'doughnut',
    data: {
      labels: ['UPI / Online', 'Cash', 'Card'],
      datasets: [{
        data: [pay.upi, pay.cash, pay.card],
        backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
    }
  });

  // 2. Hourly Rush Bar Chart
  const labels = Array.from({length: 24}, (_, i) => {
    const ampm = i >= 12 ? 'PM' : 'AM';
    const h = i % 12 || 12;
    return `${h} ${ampm}`;
  });

  const ctxHour = document.getElementById('hourlyChart').getContext('2d');
  hourlyChartInstance = new Chart(ctxHour, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Orders',
        data: hourly,
        backgroundColor: '#14b8a6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderTopItems(itemsMap) {
  const container = document.getElementById("topItemsList");
  
  const sortedItems = Object.keys(itemsMap)
    .map(name => ({ name, qty: itemsMap[name].qty, rev: itemsMap[name].rev }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10); // Take Top 10

  if (sortedItems.length === 0) {
    container.innerHTML = `<div class="empty" style="padding:20px;">No items sold yet.</div>`;
    return;
  }

  container.innerHTML = sortedItems.map((it, idx) => `
    <div class="top-item">
      <div class="ti-name">
        <span style="color:#94a3b8;">#${idx+1}</span>
        ${it.name}
        <span class="ti-qty">${it.qty}x</span>
      </div>
      <div class="ti-rev">${money(it.rev)}</div>
    </div>
  `).join('');
}

function filterRows() {
  const q = (document.getElementById("searchBox").value || "").toLowerCase();
  document.querySelectorAll(".data-row").forEach((r) => {
    r.style.display = r.cells[0].innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

function loadReport() {
  document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
  buildReport();
}

document.addEventListener("DOMContentLoaded", () => {
  setRange("all"); 
  fetchAllOrders();
});