// ==============================
// ORDER-WISE SALES REPORT (Excel style)
// Uses /api/orders  (no reports API needed)
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

// ---------- helpers ----------
function pad(n) {
  return String(n).padStart(2, "0");
}

function toYMD(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function orderDayKey(order) {
  const d = new Date(order.createdAt || order.created_at || Date.now());
  if (isNaN(d.getTime())) return "unknown";
  return toYMD(d);
}

function formatDateLabel(order) {
  const d = new Date(order.createdAt || order.created_at || Date.now());
  if (isNaN(d.getTime())) return "-";
  // like: 5-Apr-22
  const day = d.getDate();
  const mon = d.toLocaleString("en-IN", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yy}`;
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

function itemCount(order) {
  if (!Array.isArray(order.items)) return 0;
  return order.items.reduce((sum, it) => sum + (num(it.qty) || 1), 0);
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("complete")) return "st-completed";
  if (s.includes("cancel")) return "st-cancelled";
  if (s.includes("ready")) return "st-ready";
  if (s.includes("prepar") || s.includes("bak")) return "st-preparing";
  return "st-new";
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
    const day = now.getDay() || 7;
    start.setDate(now.getDate() - day + 1);
  } else if (type === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (type === "all") {
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("statusFilter").value = "all";
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
  tbody.innerHTML = `<tr><td colspan="11" class="empty">⏳ Loading orders...</td></tr>`;

  const urls = [
    `${API_URL}/orders?limit=5000`,
    `${API_URL}/orders`,
    `${API_URL}/orders/all`,
  ];

  let orders = [];

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
      if (!res.ok) continue;

      const data = await res.json();
      orders = Array.isArray(data) ? data : data.orders || data.data || [];
      console.log("✅ Orders loaded:", orders.length, "from", url);
      break;
    } catch (e) {
      console.error(e);
    }
  }

  ALL_ORDERS = orders || [];
  buildReport();
}

// ---------- build order-wise report ----------
function buildReport() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const statusFilter = (document.getElementById("statusFilter").value || "all").toLowerCase();

  let list = ALL_ORDERS.slice();

  // Date filter
  if (start && end) {
    list = list.filter((o) => {
      const key = orderDayKey(o);
      return key >= start && key <= end;
    });
  }

  // Status filter
  if (statusFilter !== "all") {
    list = list.filter((o) => {
      const s = String(o.status || "").toLowerCase().trim();
      if (statusFilter === "preparing") {
        return s === "preparing" || s === "baking" || s === "in-kitchen";
      }
      if (statusFilter === "cancelled") {
        return s === "cancelled" || s === "canceled" || s === "cancel" || s === "rejected";
      }
      return s === statusFilter;
    });
  }

  // Newest first
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  renderReport(list);
}

function renderReport(list) {
  const tbody = document.getElementById("reportBody");
  const tfoot = document.getElementById("reportFoot");

  let kNet = 0;
  let kOrders = 0;
  let kTax = 0;
  let kCancelAmt = 0;
  let kCancelCount = 0;

  let tItems = 0;
  let tSub = 0;
  let tDisc = 0;
  let tTax = 0;
  let tCharges = 0;
  let tNet = 0;

  if (!list.length) {
    document.getElementById("kpiNet").innerText = "₹0.00";
    document.getElementById("kpiOrders").innerText = "0";
    document.getElementById("kpiTax").innerText = "₹0.00";
    document.getElementById("kpiCancel").innerText = "₹0.00";
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No sales data found for selected period.<br><small>Orders in memory: ${ALL_ORDERS.length}</small></td></tr>`;
    tfoot.style.display = "none";
    return;
  }

  let html = "";

  list.forEach((o, idx) => {
    const cancelled = isCancelled(o);

    const subTotal = num(o.subtotal ?? o.subTotal);
    const discount = num(o.discount);
    const tax = num(o.gstAmount ?? o.tax ?? o.gst);
    const charges = num(o.deliveryCharge) + num(o.serviceCharge) + num(o.charges);
    const net = num(o.grandTotal ?? o.totalAmount ?? o.total);
    const itemsQty = itemCount(o);

    const custName =
      o.customer?.name && o.customer.name !== "N/A"
        ? o.customer.name
        : o.customerName || "Guest";

    const invoice = o.orderNumber || o.invoiceNo || "-";
    const status = o.status || "-";

    // KPIs
    if (cancelled) {
      kCancelAmt += net;
      kCancelCount += 1;
    } else {
      kNet += net;
      kOrders += 1;
      kTax += tax;

      tItems += itemsQty;
      tSub += subTotal || Math.max(net - tax - charges + discount, 0);
      tDisc += discount;
      tTax += tax;
      tCharges += charges;
      tNet += net;
    }

    // For cancelled, still show row but net can be shown as 0 or actual — sheet shows values; we show actual + status
    const rowSub = subTotal || Math.max(net - tax - charges + discount, 0);
    const rowNet = cancelled ? 0 : net; // cancelled net sales = 0 in total; still show amount in red optional

    html += `
      <tr class="data-row">
        <td>${idx + 1}</td>
        <td>${formatDateLabel(o)}</td>
        <td><b>${invoice}</b></td>
        <td>${custName}</td>
        <td>${itemsQty}</td>
        <td>${money(rowSub)}</td>
        <td class="c-orange">${money(discount)}</td>
        <td>${money(tax)}</td>
        <td>${money(charges)}</td>
        <td class="${cancelled ? "c-red" : "c-blue"}">${money(cancelled ? net : net)}</td>
        <td><span class="badge-status ${statusClass(status)}">${status}</span></td>
      </tr>
    `;

    // If you want cancelled excluded from visible net column display as 0:
    // change above net cell to: ${money(cancelled ? 0 : net)}
  });

  // KPI cards
  document.getElementById("kpiNet").innerText = money(kNet);
  document.getElementById("kpiOrders").innerText = kOrders;
  document.getElementById("kpiTax").innerText = money(kTax);
  document.getElementById("kpiCancel").innerText = `${money(kCancelAmt)} (${kCancelCount})`;

  tbody.innerHTML = html;

  // Footer subtotal (only non-cancelled contribution like sheet "Subtotal")
  tfoot.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:right;">Subtotal</td>
      <td>${tItems}</td>
      <td>${money(tSub)}</td>
      <td class="c-orange">${money(tDisc)}</td>
      <td>${money(tTax)}</td>
      <td>${money(tCharges)}</td>
      <td class="c-blue">${money(tNet)}</td>
      <td></td>
    </tr>
  `;
  tfoot.style.display = "table-footer-group";
}

function filterRows() {
  const q = (document.getElementById("searchBox").value || "").toLowerCase();
  document.querySelectorAll(".data-row").forEach((row) => {
    const invoice = row.cells[2]?.innerText.toLowerCase() || "";
    const name = row.cells[3]?.innerText.toLowerCase() || "";
    row.style.display = invoice.includes(q) || name.includes(q) ? "" : "none";
  });
}

function loadReport() {
  document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
  buildReport();
}

// status dropdown change pe auto apply
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("statusFilter")?.addEventListener("change", buildReport);
  setRange("today");
  fetchAllOrders();
});