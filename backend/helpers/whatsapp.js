const axios = require('axios');

const WAPI_BASE_URL = (process.env.POWERSTEXT_BASE_URL || 'https://wapi.powerstext.in').replace(/\/$/, '');
const POWERSTEXT_USER = process.env.POWERSTEXT_USER || 'PerfectPizzaWHATPP';
const POWERSTEXT_PASS = process.env.POWERSTEXT_PASS || 'N@3vtk32t5';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

let WORKING_ENDPOINT_CACHE = null;

// 10 digit -> 91XXXXXXXXXX
function toWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return null;
  return `91${last10}`;
}

function formatDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return { date, time };
}

function buildInvoiceMessage(order) {
  const name =
    order?.customer?.name && order.customer.name !== 'Guest'
      ? order.customer.name
      : 'Customer';

  const billNo = order?.orderNumber || 'ORD-TEST';
  const amount = Number(order?.grandTotal || 0);
  const paidAmount =
    String(order?.paymentMethod || '').toLowerCase() === 'pending'
      ? 0
      : amount;

  const rewardPoints = Number(order?.rewardCoinsEarned || 0);
  const { date, time } = formatDateTime(order?.createdAt);

  const orderTypeMap = {
    delivery: 'Home Delivery',
    takeaway: 'Takeaway',
    'dine-in': 'Dine-in',
  };
  const orderType =
    orderTypeMap[String(order?.orderType || '').toLowerCase()] ||
    (order?.orderType || 'Order');

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

/**
 * Direct WAPI Powerstext Sender
 */
async function sendViaWAPI(to91, message) {
  if (WORKING_ENDPOINT_CACHE) {
    try {
      const res = await axios({
        method: WORKING_ENDPOINT_CACHE.method,
        url: WORKING_ENDPOINT_CACHE.url,
        params: WORKING_ENDPOINT_CACHE.params ? WORKING_ENDPOINT_CACHE.params(to91, message) : undefined,
        data: WORKING_ENDPOINT_CACHE.data ? WORKING_ENDPOINT_CACHE.data(to91, message) : undefined,
        timeout: 12000,
        validateStatus: () => true
      });
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      if (res.status >= 200 && res.status < 300 && !resStr.toLowerCase().includes('failed') && !resStr.toLowerCase().includes('error')) {
        return { ok: true, response: res.data };
      }
    } catch (e) {
      WORKING_ENDPOINT_CACHE = null;
    }
  }

  // Common WAPI Endpoints
  const attempts = [
    // 1. GET /send-message (Standard WAPI format)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, receiver: num, message: msg })
    },
    // 2. GET /send-message (to parameter)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, to: num, message: msg })
    },
    // 3. GET /api/send-message
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/api/send-message`,
      params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg })
    },
    // 4. GET /api/sendtext.php
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/api/sendtext.php`,
      params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg })
    },
    // 5. POST /api/send (JSON)
    {
      method: 'POST',
      url: `${WAPI_BASE_URL}/api/send`,
      data: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, to: num, message: msg }),
      headers: { 'Content-Type': 'application/json' }
    },
    // 6. POST /send-message (Form Data)
    {
      method: 'POST',
      url: `${WAPI_BASE_URL}/send-message`,
      data: (num, msg) => new URLSearchParams({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, receiver: num, message: msg }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  ];

  let lastError = null;

  for (const item of attempts) {
    try {
      const config = {
        method: item.method,
        url: item.url,
        timeout: 10000,
        validateStatus: () => true
      };

      if (item.params) config.params = item.params(to91, message);
      if (item.data) config.data = typeof item.data === 'function' ? item.data(to91, message) : item.data;
      if (item.headers) config.headers = item.headers;

      const res = await axios(config);
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');

      console.log(`📡 WAPI Attempt [${item.method} ${item.url}] -> Status: ${res.status} | Res: ${resStr.slice(0, 120)}`);

      const isSuccess =
        res.status >= 200 &&
        res.status < 300 &&
        !resStr.toLowerCase().includes('404 not found') &&
        !resStr.toLowerCase().includes('invalid password') &&
        !resStr.toLowerCase().includes('unauthorized');

      if (isSuccess) {
        console.log(`🎉 SUCCESS! WAPI Powerstext Connected: ${item.url}`);
        WORKING_ENDPOINT_CACHE = item;
        return { ok: true, response: res.data, url: item.url };
      } else {
        lastError = new Error(`HTTP ${res.status}: ${resStr.slice(0, 100)}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('WAPI Powerstext connection failed');
}

/**
 * Main Function Called by Controller / Test Route
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const to91 = toWhatsAppNumber(phone);
    if (!to91) {
      console.log('⚠️ WhatsApp skipped: invalid phone', phone);
      return { ok: false, reason: 'invalid_phone' };
    }

    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      console.log('⚠️ WhatsApp skipped: pending payment order');
      return { ok: false, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    console.log(`📲 Sending WA Invoice to ${to91} via WAPI...`);
    const result = await sendViaWAPI(to91, message);

    return result;
  } catch (err) {
    console.error('❌ WhatsApp Send Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber,
};