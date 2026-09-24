const axios = require('axios');

// Naya Personal Access Token (PAT)
const API_TOKEN = 'fb8f9c05b518a'; 
const WAPI_BASE_URL = 'https://wapi.powerstext.in';
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
 * Token-Based WhatsApp Sender for WAPI
 */
async function sendViaWAPIToken(phone10, message) {
  const phone12 = '91' + phone10;

  // List of Token-based endpoints for WAPI
  const attempts = [
    // 1. /api/send (Most stable REST API)
    {
      url: `${WAPI_BASE_URL}/api/send`,
      method: 'GET',
      params: (p12, p10, msg) => ({ token: API_TOKEN, number: p12, message: msg })
    },
    // 2. /api/send-message
    {
      url: `${WAPI_BASE_URL}/api/send-message`,
      method: 'GET',
      params: (p12, p10, msg) => ({ token: API_TOKEN, number: p12, message: msg })
    },
    // 3. /api/send-text
    {
      url: `${WAPI_BASE_URL}/api/send-text`,
      method: 'GET',
      params: (p12, p10, msg) => ({ token: API_TOKEN, number: p12, message: msg })
    },
    // 4. POST JSON /api/send
    {
      url: `${WAPI_BASE_URL}/api/send`,
      method: 'POST',
      data: (p12, p10, msg) => ({ token: API_TOKEN, number: p12, message: msg }),
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  let lastError = null;

  for (const item of attempts) {
    try {
      const config = {
        method: item.method,
        url: item.url,
        params: item.params ? item.params(phone12, phone10, message) : undefined,
        data: item.data ? item.data(phone12, phone10, message) : undefined,
        headers: item.headers || undefined,
        timeout: 10000,
        validateStatus: () => true
      };

      const res = await axios(config);
      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');

      console.log(`📡 Token Attempt [${config.method} ${item.url}] -> Status: ${res.status} | Res: ${resStr.slice(0, 150)}`);

      // Success if JSON contains true or status 200 without error text
      const isSuccess = res.status >= 200 && res.status < 300 && 
                        !resStr.toLowerCase().includes('failed') && 
                        !resStr.toLowerCase().includes('error') &&
                        !resStr.includes('<!DOCTYPE');

      if (isSuccess) {
        console.log(`🎉 SUCCESS! WhatsApp sent using Token API via ${item.url}`);
        return { ok: true, response: res.data };
      } else {
        lastError = new Error(`API Response: ${resStr.slice(0, 100)}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Token-based endpoints failed');
}

/**
 * Main Function Called by Controller / Test Route
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) return { ok: false, error: 'invalid_phone' };

    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      return { ok: false, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    console.log(`📲 Sending WA Invoice via Token Key to ${phone10}...`);
    const result = await sendViaWAPIToken(phone10, message);

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