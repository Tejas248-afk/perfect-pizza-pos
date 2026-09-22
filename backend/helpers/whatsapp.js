const axios = require('axios');

const POWERSTEXT_USER = process.env.POWERSTEXT_USER || 'PerfectPizzaWHATPP';
const POWERSTEXT_PASS = process.env.POWERSTEXT_PASS || 'edf65';
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
 * Advanced Scanner for Powerstext Root PHP & API Endpoints
 */
async function sendViaPowerstext(to91, message) {
  if (WORKING_ENDPOINT_CACHE) {
    try {
      const res = await axios({
        method: WORKING_ENDPOINT_CACHE.method,
        url: WORKING_ENDPOINT_CACHE.url,
        params: WORKING_ENDPOINT_CACHE.params ? WORKING_ENDPOINT_CACHE.params(to91, message) : undefined,
        data: WORKING_ENDPOINT_CACHE.data ? WORKING_ENDPOINT_CACHE.data(to91, message) : undefined,
        timeout: 10000,
        validateStatus: () => true
      });
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      if (res.status >= 200 && res.status < 300 && !resStr.toLowerCase().includes('not found')) {
        return { ok: true, response: res.data };
      }
    } catch (e) {
      WORKING_ENDPOINT_CACHE = null;
    }
  }

  const bases = ['https://wapp.powerstext.in', 'http://wapp.powerstext.in'];
  
  // Powerstext PHP Root & API Endpoints list
  const endpoints = [
    // 1. Root Level PHP Scripts (Most common in Powerstext/PHP Panels)
    { path: '/sendtext.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/sendtext.php', method: 'GET', params: (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, to: num, message: msg }) },
    { path: '/sendsms.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/send_sms.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, mobile: num, message: msg }) },
    { path: '/send.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/send-message.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/api.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/whatsapp.php', method: 'GET', params: (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, mobile: num, msg: msg }) },
    
    // 2. Dashed API Paths
    { path: '/api/send-text', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/api/send-message', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/api/send-whatsapp', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/api/send-sms', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },
    { path: '/api/send_sms.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, mobile: num, message: msg }) },
    { path: '/api/sendsms.php', method: 'GET', params: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }) },

    // 3. Direct Route paths
    { path: '/send-message', method: 'GET', params: (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, to: num, message: msg }) },
    { path: '/send-text', method: 'GET', params: (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, to: num, message: msg }) },

    // 4. POST Form-Data Attempts
    {
      path: '/sendtext.php',
      method: 'POST',
      data: (num, msg) => new URLSearchParams({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    },
    {
      path: '/api/send-text',
      method: 'POST',
      data: (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }),
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  let lastError = null;

  for (const base of bases) {
    for (const ep of endpoints) {
      const fullUrl = base + ep.path;
      try {
        const config = {
          method: ep.method,
          url: fullUrl,
          timeout: 7000,
          validateStatus: () => true
        };

        if (ep.params) config.params = ep.params(to91, message);
        if (ep.data) config.data = typeof ep.data === 'function' ? ep.data(to91, message) : ep.data;
        if (ep.headers) config.headers = ep.headers;

        const res = await axios(config);
        const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');

        // Log non-404 responses
        if (res.status !== 404) {
          console.log(`🌐 WA Attempt [${ep.method} ${fullUrl}] -> Status: ${res.status} | Res: ${resStr.slice(0, 120)}`);
        }

        const isSuccess =
          res.status >= 200 &&
          res.status < 300 &&
          !resStr.toLowerCase().includes('404 not found') &&
          !resStr.toLowerCase().includes('file not found');

        if (isSuccess) {
          console.log(`🎉 SUCCESS! Found Working Powerstext Endpoint: ${fullUrl}`);
          WORKING_ENDPOINT_CACHE = { method: ep.method, url: fullUrl, params: ep.params, data: ep.data };
          return { ok: true, response: res.data, url: fullUrl };
        } else if (res.status !== 404) {
          lastError = new Error(`HTTP ${res.status}: ${resStr.slice(0, 100)}`);
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('All Powerstext endpoints returned 404/Error');
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
    console.log(`📲 Sending WA Message to ${to91}...`);
    const result = await sendViaPowerstext(to91, message);

    return result;
  } catch (err) {
    console.error('❌ WhatsApp Send Final Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber,
};