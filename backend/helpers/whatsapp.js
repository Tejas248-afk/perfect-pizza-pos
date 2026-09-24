const axios = require('axios');

// Hardcode WAPI Domain & Credentials for naya panel
const WAPI_BASE_URL = 'https://wapi.powerstext.in';
const POWERSTEXT_USER = 'PerfectPizzaWHATPP';
const POWERSTEXT_PASS = 'N@3vtk32t5';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

let WORKING_ENDPOINT_CACHE = null;

// Clean phone to 10 digits
function get10Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : null;
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
 * Direct WAPI Powerstext Sender with Strict Response Checking
 */
async function sendViaWAPI(phone10, message) {
  const phone12 = '91' + phone10;

  // Cached working route
  if (WORKING_ENDPOINT_CACHE) {
    try {
      const res = await axios({
        method: WORKING_ENDPOINT_CACHE.method,
        url: WORKING_ENDPOINT_CACHE.url,
        params: WORKING_ENDPOINT_CACHE.getParams(phone12, phone10, message),
        data: WORKING_ENDPOINT_CACHE.getData ? WORKING_ENDPOINT_CACHE.getData(phone12, phone10, message) : undefined,
        headers: WORKING_ENDPOINT_CACHE.headers || undefined,
        timeout: 10000,
        validateStatus: () => true
      });

      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      const lower = resStr.toLowerCase();

      if (res.status >= 200 && res.status < 300 && !lower.includes('failed') && !lower.includes('error') && !lower.includes('code":"001"')) {
        return { ok: true, response: res.data };
      }
    } catch (e) {
      WORKING_ENDPOINT_CACHE = null;
    }
  }

  // Permutations for WAPI panel
  const attempts = [
    // 1. GET /send-message (12 digit, receiver)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, type: 'text', receiver: p12, message: msg })
    },
    // 2. GET /send-message (10 digit, receiver)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, type: 'text', receiver: p10, message: msg })
    },
    // 3. GET /send-message (12 digit, number)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: p12, message: msg })
    },
    // 4. GET /send-message (12 digit, to)
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/send-message`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, to: p12, message: msg })
    },
    // 5. GET /api/sendtext.php
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/api/sendtext.php`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: p12, message: msg })
    },
    // 6. GET /api/send
    {
      method: 'GET',
      url: `${WAPI_BASE_URL}/api/send`,
      getParams: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: p12, message: msg })
    },
    // 7. POST /send-message (JSON)
    {
      method: 'POST',
      url: `${WAPI_BASE_URL}/send-message`,
      getData: (p12, p10, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, receiver: p12, message: msg }),
      getParams: () => ({}),
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  let lastError = null;

  for (const item of attempts) {
    try {
      const config = {
        method: item.method,
        url: item.url,
        timeout: 8000,
        validateStatus: () => true
      };

      if (item.getParams) config.params = item.getParams(phone12, phone10, message);
      if (item.getData) config.data = item.getData(phone12, phone10, message);
      if (item.headers) config.headers = item.headers;

      const res = await axios(config);
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      const lower = resStr.toLowerCase();

      console.log(`📡 WAPI Attempt [${item.method} ${item.url}] -> Status: ${res.status} | Res: ${resStr.slice(0, 120)}`);

      // STRICT SUCCESS CHECK
      const isFailed = lower.includes('failed') || 
                       lower.includes('error') || 
                       lower.includes('invalid') || 
                       lower.includes('unauthorized') || 
                       lower.includes('404 not found') ||
                       lower.includes('code":"001"') ||
                       lower.includes('code":"002"');

      const isSuccess = res.status >= 200 && res.status < 300 && !isFailed;

      if (isSuccess) {
        console.log(`🎉 SUCCESS! WAPI Powerstext Verified: ${item.url}`);
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
 * Main Function
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) {
      console.log('⚠️ WhatsApp skipped: invalid phone', phone);
      return { ok: false, reason: 'invalid_phone' };
    }

    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      console.log('⚠️ WhatsApp skipped: pending payment order');
      return { ok: false, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    console.log(`📲 Sending WA Invoice to ${phone10} via WAPI...`);
    const result = await sendViaWAPI(phone10, message);

    return result;
  } catch (err) {
    console.error('❌ WhatsApp Send Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber: get10Digits,
};