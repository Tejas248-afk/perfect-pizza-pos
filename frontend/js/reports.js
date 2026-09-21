// ==============================
// ORDER-WISE SALES REPORT + INVOICE PRINT
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

  let kNet = 0; let kOrders = 0; let kTax = 0;
  let kCancelAmt = 0; let kCancelCount = 0;
  let tItems = 0; let tSub = 0; let tDisc = 0;
  let tTax = 0; let tCharges = 0; let tNet = 0;

  if (!list.length) {
    document.getElementById("kpiNet").innerText = "₹0.00";
    document.getElementById("kpiOrders").innerText = "0";
    document.getElementById("kpiTax").innerText = "₹0.00";
    document.getElementById("kpiCancel").innerText = "₹0.00";
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No sales data found for selected period.</td></tr>`;
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

    const custName = o.customer?.name && o.customer.name !== "N/A" ? o.customer.name : o.customerName || "Guest";
    const invoice = o.orderNumber || o.invoiceNo || "-";
    const status = o.status || "-";

    // KPIs calculation
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

    const rowSub = subTotal || Math.max(net - tax - charges + discount, 0);

    // Row HTML (With Invoice Button)
    html += `
      <tr class="data-row">
        <td>${idx + 1}</td>
        <td>${formatDateLabel(o)}</td>
        <td><b>${invoice}</b></td>
        <td>
          <div style="display:flex; align-items:center; gap:10px; justify-content:space-between; min-width:130px;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;" title="${custName}">${custName}</span>
            <button type="button" class="btn-inv" onclick="printInvoice('${o._id}')" title="View/Print Invoice">🧾</button>
          </div>
        </td>
        <td>${itemsQty}</td>
        <td>${money(rowSub)}</td>
        <td class="c-orange">${money(discount)}</td>
        <td>${money(tax)}</td>
        <td>${money(charges)}</td>
        <td class="${cancelled ? "c-red" : "c-blue"}">${money(net)}</td>
        <td><span class="badge-status ${statusClass(status)}">${status}</span></td>
      </tr>
    `;
  });

  // KPI cards update
  document.getElementById("kpiNet").innerText = money(kNet);
  document.getElementById("kpiOrders").innerText = kOrders;
  document.getElementById("kpiTax").innerText = money(kTax);
  document.getElementById("kpiCancel").innerText = `${money(kCancelAmt)} (${kCancelCount})`;

  tbody.innerHTML = html;

  // Footer subtotal
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

// ==========================================
// PRINT INDIVIDUAL INVOICE FROM REPORT
// ==========================================
window.printInvoice = async function (orderId) {
  try {
    const btn = event?.currentTarget;
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⏳";
    }

    // Fetch full order detail
    const res = await fetch(`${API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to load invoice details");

    const order = await res.json();
    generateReportInvoice(order);
    window.print(); // Triggers print dialog

    if (btn) {
      btn.disabled = false;
      btn.innerText = "🧾";
    }
  } catch (err) {
    console.error(err);
    alert("Invoice load failed: " + err.message);
    if (event?.currentTarget) {
      event.currentTarget.disabled = false;
      event.currentTarget.innerText = "🧾";
    }
  }
};

// Generates POS style thermal receipt HTML inside #printReceipt div
function generateReportInvoice(order) {
  let box = document.getElementById("printReceipt");
  if (!box) {
    box = document.createElement("div");
    box.id = "printReceipt";
    box.className = "print-only";
    document.body.appendChild(box);
  }

  const items = order.items || [];
  let itemsHtml = items
    .map((item) => {
      const name = item.product?.name || item.productName || "Item";
      const unit =
        (Number(item.basePrice) || 0) +
        (Number(item.crustPrice) || 0) +
        (Number(item.addonsTotal) || 0);
      const lineTotal = unit * (Number(item.qty) || 1);

      let extras = [];
      if (item.size) extras.push(String(item.size).toUpperCase());
      if (item.crust?.name) extras.push(item.crust.name);
      if (Array.isArray(item.addons)) {
        item.addons.forEach((a) => {
          if (a?.name) extras.push(a.name);
        });
      }
      if (item.comboSelections) extras.push(...item.comboSelections);

      return `
        <div style="display:flex; justify-content:space-between; margin:5px 0;">
          <div>
            <div style="font-weight:bold;">${item.qty} x ${name}</div>
            ${extras.length ? `<div style="font-size:11px; color:#555;">${extras.join(", ")}</div>` : ""}
          </div>
          <div>₹${lineTotal}</div>
        </div>
      `;
    })
    .join("");

  const date = new Date(order.createdAt || Date.now()).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const custName = order.customer?.name && order.customer.name !== "N/A" ? order.customer.name : "Guest";
  const custPhone = order.customer?.phone && order.customer.phone !== "N/A" ? order.customer.phone : "";
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const coinsVal = Number(order.rewardCoinsValue) || 0;
  const service = Number(order.serviceCharge) || 0;
  const delivery = Number(order.deliveryCharge) || 0;
  const gst = Number(order.gstAmount) || 0;
  const total = Number(order.grandTotal) || 0;
  const payMethod = (order.paymentMethod || "CASH").toUpperCase();

  box.innerHTML = `
    <div style="width:300px; margin:0 auto; font-family:monospace; font-size:12px; color:#000;">
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:16px; font-weight:bold; margin-bottom:4px;">PERFECT PIZZA</div>
        <div>100% Pure Mozzarella's Pizza</div>
        <div>Singhpur Chauraha, Kalyanpur</div>
        <div>Ph: 9889229198</div>
        <div>GSTIN: 09BCVPDD4203L2ZB</div>
      </div>
      <hr style="border-top:1px dashed #000;"/>
      <div><b>Bill No:</b> ${order.orderNumber || "-"}</div>
      <div><b>Date:</b> ${date}</div>
      <div><b>Type:</b> ${(order.orderType || "").toUpperCase()}</div>
      <div><b>Customer:</b> ${custName}${custPhone ? " | " + custPhone : ""}</div>
      <div><b>Status:</b> ${order.status || "-"}</div>
      <hr style="border-top:1px dashed #000;"/>
      ${itemsHtml}
      <hr style="border-top:1px dashed #000;"/>
      <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>₹${subtotal}</span></div>
      ${discount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount</span><span>-₹${discount}</span></div>` : ""}
      ${coinsVal > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Coins Used</span><span>-₹${coinsVal}</span></div>` : ""}
      ${service > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Service Charge</span><span>+₹${service}</span></div>` : ""}
      ${delivery > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Delivery</span><span>+₹${delivery}</span></div>` : ""}
      ${gst > 0 ? `<div style="display:flex; justify-content:space-between;"><span>GST (5%)</span><span>+₹${gst.toFixed(2)}</span></div>` : ""}
      <hr style="border-top:1px dashed #000;"/>
      <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;">
        <span>TOTAL</span><span>₹${total}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Payment</span><span>${payMethod}</span>
      </div>
      <hr style="border-top:1px dashed #000;"/>
      <div style="text-align:center; margin-top:10px;">Thank You! Visit Again</div>
    </div>
  `;
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("statusFilter")?.addEventListener("change", buildReport);
  setRange("today");
  fetchAllOrders();
});