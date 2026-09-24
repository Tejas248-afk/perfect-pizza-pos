const axios = require('axios');

// Environment Variable or Hardcoded Fallback Token
const API_TOKEN = process.env.POWERSTEXT_TOKEN || 'fb8f9c05b518a'; 
const WAPI_SEND_URL = 'https://wapi.powerstext.in/api/send';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

let WORKING_CONFIG_CACHE = null;

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
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return { date, time };
}

function buildInvoiceMessage(order) {
  const name = order?.customer?.name && order.customer.name !== 'Guest' ? order.customer.name : 'Customer';
  const billNo = order?.orderNumber || 'ORD-TEST';
  const amount = Number(order?.grandTotal || 0);
  const paidAmount = String(order?.paymentMethod || '').toLowerCase() === 'pending' ? 0 : amount;
  const rewardPoints = Number(order?.rewardCoinsEarned || 0);
  const { date, time } = formatDateTime(order?.createdAt);

  const orderTypeMap = { delivery: 'Home Delivery', takeaway: 'Takeaway', 'dine-in': 'Dine-in' };
  const orderType = orderTypeMap[String(order?.orderType || '').toLowerCase()] || (order?.orderType || 'Order');

  const invoiceLink = order?._id ? `${INVOICE_BASE_URL}/invoice.html?id=${order._id}` : `${INVOICE_BASE_URL}`;

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
 * Access Token Based WhatsApp Sender for WAPI (/api/send)
 */
async function sendViaWAPIAccessToken(phone10, message) {
  const phone12 = '91' + phone10;

  // Cached Working Config
  if (WORKING_CONFIG_CACHE) {
    try {
      const res = await axios({
        method: WORKING_CONFIG_CACHE.method,
        url: WAPI_SEND_URL,
        params: WORKING_CONFIG_CACHE.getParams ? WORKING_CONFIG_CACHE.getParams(phone12, phone10, message) : undefined,
        data: WORKING_CONFIG_CACHE.getData ? WORKING_CONFIG_CACHE.getData(phone12, phone10, message) : undefined,
        headers: WORKING_CONFIG_CACHE.headers || undefined,
        timeout: 10000,
        validateStatus: () => true
      });
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      if (res.status >= 200 && res.status < 300 && !resStr.toLowerCase().includes('error')) {
        return { ok: true, response: res.data };
      }
    } catch (e) {
      WORKING_CONFIG_CACHE = null;
    }
  }

  // Permutations for /api/send using access_token
  const attempts = [
    // 1. GET with access_token & number (12 digits)
    {
      method: 'GET',
      getParams: (p12, p10, msg) => ({ access_token: API_TOKEN, number: p12, message: msg })
    },
    // 2. GET with access_token & to (12 digits)
    {
      method: 'GET',
      getParams: (p12, p10, msg) => ({ access_token: API_TOKEN, to: p12, message: msg })
    },
    // 3. GET with access_token & receiver (12 digits)
    {
      method: 'GET',
      getParams: (p12, p10, msg) => ({ access_token: API_TOKEN, receiver: p12, message: msg })
    },
    // 4. GET with access_token & type=text
    {
      method: 'GET',
      getParams: (p12, p10, msg) => ({ access_token: API_TOKEN, type: 'text', number: p12, message: msg })
    },
    // 5. POST JSON with access_token in Body
    {
      method: 'POST',
      getData: (p12, p10, msg) => ({ access_token: API_TOKEN, number: p12, message: msg }),
      headers: { 'Content-Type': 'application/json' }
    },
    // 6. POST JSON with access_token & to
    {
      method: 'POST',
      getData: (p12, p10, msg) => ({ access_token: API_TOKEN, to: p12, message: msg }),
      headers: { 'Content-Type': 'application/json' }
    },
    // 7. POST with Authorization Header
    {
      method: 'POST',
      getData: (p12, p10, msg) => ({ number: p12, message: msg }),
      headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' }
    },
    // 8. GET with 10 digits number
    {
      method: 'GET',
      getParams: (p12, p10, msg) => ({ access_token: API_TOKEN, number: p10, message: msg })
    }
  ];

  let lastError = null;

  for (const item of attempts) {
    try {
      const config = {
        method: item.method,
        url: WAPI_SEND_URL,
        params: item.getParams ? item.getParams(phone12, phone10, message) : undefined,
        data: item.getData ? item.getData(phone12, phone10, message) : undefined,
        headers: item.headers || undefined,
        timeout: 10000,
        validateStatus: () => true
      };

      const res = await axios(config);
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');

      console.log(`📡 WAPI Token Attempt [${item.method}] -> Status: ${res.status} | Res: ${resStr.slice(0, 150)}`);

      const lower = resStr.toLowerCase();
      const isFailed = lower.includes('error') || lower.includes('failed') || lower.includes('invalid') || lower.includes('unauthorized');
      const isSuccess = res.status >= 200 && res.status < 300 && !isFailed;

      if (isSuccess) {
        console.log(`🎉 SUCCESS! WAPI WhatsApp Sent via /api/send`);
        WORKING_CONFIG_CACHE = item;
        return { ok: true, response: res.data };
      } else {
        lastError = new Error(`HTTP ${res.status}: ${resStr}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('WAPI Access Token Send Failed');
}

/**
 * Main Function
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) return { ok: false, error: 'invalid_phone' };

    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      return { ok: false, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    console.log(`📲 Sending WA Invoice via Access Token to ${phone10}...`);
    const result = await sendViaWAPIAccessToken(phone10, message);

    return result;
  } catch (err) {
    console.error('❌ WhatsApp Token API Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber: get10Digits,
};