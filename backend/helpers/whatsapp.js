const axios = require('axios');

// ==============================
// CONFIG
// ==============================
const API_TOKEN = process.env.POWERSTEXT_TOKEN || 'fb8f9c05b518a';
const WAPI_SEND_URL = 'https://wapi.powerstext.in/api/send';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

// 🛑 ANTI-DUPLICATE CACHE (Locks Order ID for 2 Minutes)
const SENT_CACHE = new Set();

function isDuplicateCall(orderIdOrNum, isCancellation) {
  if (!orderIdOrNum) return false;
  const key = `${orderIdOrNum}_${isCancellation ? 'cancel' : 'invoice'}`;
  
  if (SENT_CACHE.has(key)) {
    return true; // DUPLICATE DETECTED!
  }

  SENT_CACHE.add(key);
  setTimeout(() => SENT_CACHE.delete(key), 120000); // 2 Min Lock
  return false;
}

// ==============================
// HELPERS
// ==============================
function get10Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : null;
}

function formatDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
  return { date, time };
}

// 1. Invoice Message Template
function buildInvoiceMessage(order = {}) {
  const name =
    order?.customer?.name && String(order.customer.name).toLowerCase() !== 'guest'
      ? order.customer.name
      : 'Customer';

  const billNo = order?.orderNumber || 'ORD-TEST';
  const amount = Number(order?.grandTotal || 0);
  const paidAmount = String(order?.paymentMethod || '').toLowerCase() === 'pending' ? 0 : amount;
  const rewardPoints = Number(order?.rewardCoinsEarned || 0);
  const { date, time } = formatDateTime(order?.createdAt);

  const orderTypeMap = { delivery: 'Home Delivery', takeaway: 'Takeaway', 'dine-in': 'Dine-in' };
  const orderType = orderTypeMap[String(order?.orderType || '').toLowerCase()] || (order?.orderType || 'Order');

  const invoiceLink = order?._id
    ? `${INVOICE_BASE_URL}/invoice.html?id=${order._id}`
    : `${INVOICE_BASE_URL}`;

  return (
`🙏 Thank You for Ordering from *Perfect Pizza!* 🍕

Dear *${name}*,
Your delicious order has been received! 🍕🛵
Thank you for choosing *Perfect Pizza*. ❤️

🧾 *Invoice Details*
━━━━━━━━━━━━━━
👤 *Customer:* ${name}
🧾 *Invoice No:* ${billNo}
📅 *Date:* ${date} ${time}

💰 *Total Payable:* ₹${amount}
✅ *Paid Amount:* ₹${paidAmount}
🛵 *Order Type:* ${orderType}
🎁 *Reward Points Earned:* ${rewardPoints}
━━━━━━━━━━━━━━

🔥 *MORE SAVINGS ONLINE!* 🔥
🎟️ *Exclusive Online Discounts*
🍕 *Best Offers Every Day*
🎁 *Earn Reward Points*
💰 *Use Rewards on Future Orders*

🌐 *Order Online:* https://perfectpizzas.in/

🧾 *View / Print Invoice:*
${invoiceLink}

📞 *Contact:* 9889229198
📍 *Perfect Pizza*
Singhpur Chauraha, Bithoor Rd, Kalyanpur, Kanpur

✨ *Thanks again!*
🍕 *Hot, Fresh & Perfect Every Time!*`
  );
}

// 2. Cancellation Message Template
function buildCancellationMessage(order = {}) {
  const name =
    order?.customer?.name && String(order.customer.name).toLowerCase() !== 'guest'
      ? order.customer.name
      : 'Customer';
  const billNo = order?.orderNumber || '-';

  return (
`❌ *Order Cancelled* 🍕

Dear *${name}*,
Your order *#${billNo}* at *Perfect Pizza* has been cancelled.

If you have any questions or this was done by mistake, please contact us.

📞 *Contact:* 9889229198
📍 *Perfect Pizza, Kalyanpur*`
  );
}

// ==============================
// PUBLIC SENDER (EXACTLY 1 HTTP CALL - NO LOOPS)
// ==============================
async function sendDirectWhatsAppMessage(phone, order = {}, isCancellation = false) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) return { ok: false, error: 'invalid_phone' };

    // Dine-in table start (pending) pe mat bhejo
    if (!isCancellation && String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      return { ok: false, reason: 'pending_payment' };
    }

    // 🛑 DEDUPLICATION CHECK
    const orderId = order?._id || order?.orderNumber || Date.now();
    if (isDuplicateCall(orderId, isCancellation)) {
      console.log(`🛑 DUPLICATE BLOCKED: WhatsApp already sent for ${orderId}`);
      return { ok: true, skipped: 'duplicate_prevented' };
    }

    const phone12 = `91${phone10}`;
    const message = isCancellation ? buildCancellationMessage(order) : buildInvoiceMessage(order);

    console.log(`🚀 Sending SINGLE WhatsApp GET -> Phone: ${phone12} | Order: ${order?.orderNumber || 'N/A'}`);

    // 🔥 EXACTLY ONE SINGLE API CALL! NO LOOPS!
    const res = await axios.get(WAPI_SEND_URL, {
      params: {
        access_token: API_TOKEN,
        number: phone12,
        message: message,
      },
      timeout: 12000,
      validateStatus: () => true,
    });

    const resData = res.data;
    console.log(`📡 WAPI API Response:`, JSON.stringify(resData));

    return { ok: true, response: resData };
  } catch (err) {
    console.error('❌ WhatsApp Send Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  buildCancellationMessage,
  toWhatsAppNumber: get10Digits,
  get10Digits,
};