// ==============================
// NEW REPORT SYSTEM (Orders API)
// Backend reports endpoint NOT needed
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

// All orders cache
let ALL_ORDERS = [];

// ---------- helpers ----------
function pad(n) {
  return String(n).padStart(2, "0");
}

function toYMD(date) {
  // local date YYYY-MM-DD (no UTC shift)
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
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isCancelled(order) {
  const s = String(order.status || "").toLowerCase().trim();
  return ["cancelled", "canceled", "cancel", "rejected"].includes(s);
}

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function money(n) {
  return `₹${num(n).toFixed(2)}`;
}

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
    const day = now.getDay() || 7; // Monday start
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

// ---------- fetch orders (WORKING API) ----------
async function fetchAllOrders() {
  const tbody = document.getElementById("reportBody");
  tbody.innerHTML = `<tr><td colspan="9" class="empty">⏳ Loading orders...</td></tr>`;

  // Try multiple endpoints so at least one works
  const urls = [
    `${API_URL}/orders`,
    `${API_URL}/orders?limit=5000`,
    `${API_URL}/orders?today=false`,
    `${API_URL}/orders/all`,
  ];

  let orders = [];
  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        alert("Session expired. Please login again.");
        logout();
        return;
      }

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} on ${url}`);
        continue;
      }

      const data = await res.json();

      // handle different response shapes
      if (Array.isArray(data)) orders = data;
      else if (Array.isArray(data.orders)) orders = data.orders;
      else if (Array.isArray(data.data)) orders = data.data;
      else orders = [];

      console.log("✅ Orders loaded from:", url, "count:", orders.length);
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!orders.length && lastErr) {
    console.error(lastErr);
  }

  ALL_ORDERS = orders || [];
  buildReport();
}

// ---------- build report in browser ----------
function buildReport() {
  const start = document.getElementById("startDate").value; // YYYY-MM-DD or ""
  const end = document.getElementById("endDate").value;

  // filter by date (client side)
  let list = ALL_ORDERS.slice();

  if (start && end) {
    list = list.filter((o) => {
      const key = orderDayKey(o);
      return key >= start && key <= end;
    });
  }

  // group by day
  const map = {};

  list.forEach((o) => {
    const key = orderDayKey(o);
    const label = orderDayLabel(o);

    if (!map[key]) {
      map[key] = {
        date: label,
        dateKey: key,
        orders: 0,
        subTotal: 0,
        discount: 0,
        tax: 0,
        charges: 0,
        grossSales: 0,
        cancelledAmount: 0,
        cancelledOrders: 0,
        netSales: 0,
      };
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
      day.orders += 1;
      day.subTotal += subTotal;
      day.discount += discount;
      day.tax += tax;
      day.charges += charges;
      day.grossSales += grand;
      day.netSales += grand;
    }
  });

  const rows = Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  renderReport(rows);
}

function renderReport(rows) {
  const tbody = document.getElementById("reportBody");
  const tfoot = document.getElementById("reportFoot");

  // KPIs
  let kNet = 0,
    kOrders = 0,
    kTax = 0,
    kCancel = 0,
    kCancelCount = 0;

  rows.forEach((r) => {
    kNet += r.netSales;
    kOrders += r.orders;
    kTax += r.tax;
    kCancel += r.cancelledAmount;
    kCancelCount += r.cancelledOrders;
  });

  document.getElementById("kpiNet").innerText = money(kNet);
  document.getElementById("kpiOrders").innerText = kOrders;
  document.getElementById("kpiTax").innerText = money(kTax);
  document.getElementById("kpiCancel").innerText = `${money(kCancel)} (${kCancelCount})`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">No sales data found for selected period.<br><small>Total orders in memory: ${ALL_ORDERS.length}</small></td></tr>`;
    tfoot.style.display = "none";
    return;
  }

  let html = "";
  let t = {
    orders: 0,
    subTotal: 0,
    discount: 0,
    tax: 0,
    charges: 0,
    gross: 0,
    returns: 0,
    net: 0,
  };

  rows.forEach((r) => {
    t.orders += r.orders;
    t.subTotal += r.subTotal;
    t.discount += r.discount;
    t.tax += r.tax;
    t.charges += r.charges;
    t.gross += r.grossSales;
    t.returns += r.cancelledAmount;
    t.net += r.netSales;

    html += `
      <tr class="data-row">
        <td><b>${r.date}</b></td>
        <td><span class="badge">${r.orders}</span></td>
        <td>${money(r.subTotal)}</td>
        <td class="c-orange">${money(r.discount)}</td>
        <td>${money(r.tax)}</td>
        <td>${money(r.charges)}</td>
        <td>${money(r.grossSales)}</td>
        <td class="c-red">${money(r.cancelledAmount)}</td>
        <td class="c-blue">${money(r.netSales)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  tfoot.innerHTML = `
    <tr>
      <td>TOTAL</td>
      <td><span class="badge">${t.orders}</span></td>
      <td>${money(t.subTotal)}</td>
      <td class="c-orange">${money(t.discount)}</td>
      <td>${money(t.tax)}</td>
      <td>${money(t.charges)}</td>
      <td>${money(t.gross)}</td>
      <td class="c-red">${money(t.returns)}</td>
      <td class="c-blue">${money(t.net)}</td>
    </tr>
  `;
  tfoot.style.display = "table-footer-group";
}

function filterRows() {
  const q = (document.getElementById("searchBox").value || "").toLowerCase();
  document.querySelectorAll(".data-row").forEach((row) => {
    const text = row.cells[0].innerText.toLowerCase();
    row.style.display = text.includes(q) ? "" : "none";
  });
}

function loadReport() {
  // dates already selected; just rebuild from cached orders
  document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
  buildReport();
}

// boot
document.addEventListener("DOMContentLoaded", () => {
  setRange("all"); // pehle all time dikhao
  fetchAllOrders();
});