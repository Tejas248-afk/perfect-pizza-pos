const axios = require('axios');

// ==============================
// CONFIG
// ==============================
const API_TOKEN = process.env.POWERSTEXT_TOKEN || 'fb8f9c05b518a';
const WAPI_SEND_URL = 'https://wapi.powerstext.in/api/send';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

// ==============================
// HELPERS
// ==============================
function get10Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : null;
}

function toWhatsAppNumber(phone) {
  const phone10 = get10Digits(phone);
  return phone10 ? `91${phone10}` : null;
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

function buildInvoiceMessage(order = {}) {
  const name =
    order?.customer?.name && String(order.customer.name).toLowerCase() !== 'guest'
      ? order.customer.name
      : 'Customer';

  const billNo = order?.orderNumber || 'ORD-TEST';
  const amount = Number(order?.grandTotal || 0);
  const paidAmount =
    String(order?.paymentMethod || '').toLowerCase() === 'pending' ? 0 : amount;
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

// ==============================
// SEND API
// ==============================
async function sendViaWAPIAccessToken(phone10, message) {
  const phone12 = `91${phone10}`;

  // Best working attempts only
  const attempts = [
    // 1) GET access_token + number (12 digit)  ✅ main
    {
      method: 'GET',
      params: {
        access_token: API_TOKEN,
        number: phone12,
        message,
      },
    },
    // 2) GET access_token + number (10 digit)
    {
      method: 'GET',
      params: {
        access_token: API_TOKEN,
        number: phone10,
        message,
      },
    },
    // 3) POST JSON body
    {
      method: 'POST',
      data: {
        access_token: API_TOKEN,
        number: phone12,
        message,
      },
      headers: { 'Content-Type': 'application/json' },
    },
    // 4) POST JSON with to
    {
      method: 'POST',
      data: {
        access_token: API_TOKEN,
        to: phone12,
        message,
      },
      headers: { 'Content-Type': 'application/json' },
    },
  ];

  let lastError = null;

  for (const item of attempts) {
    try {
      const res = await axios({
        method: item.method,
        url: WAPI_SEND_URL,
        params: item.params || undefined,
        data: item.data || undefined,
        headers: item.headers || undefined,
        timeout: 15000,
        validateStatus: () => true,
      });

      const resStr =
        typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      const lower = resStr.toLowerCase();

      console.log(
        `📡 WAPI Attempt [${item.method}] -> Status: ${res.status} | Res: ${resStr.slice(0, 180)}`
      );

      // Special clear message for QR not connected
      if (lower.includes('no active connected whatsapp instances')) {
        return {
          ok: false,
          error:
            'No active connected WhatsApp instances found. Please open https://wapi.powerstext.in and scan QR code first.',
          response: res.data,
        };
      }

      // Reject HTML / login page
      if (lower.includes('<!doctype') || lower.includes('<html')) {
        lastError = new Error('HTML page returned instead of API JSON');
        continue;
      }

      const isFailed =
        lower.includes('"success":false') ||
        lower.includes('error') ||
        lower.includes('failed') ||
        lower.includes('unauthorized') ||
        lower.includes('invalid');

      const isSuccess =
        res.status >= 200 &&
        res.status < 300 &&
        !isFailed &&
        (res.data?.success === true ||
          lower.includes('"success":true') ||
          lower.includes('sent') ||
          lower.includes('message queued') ||
          lower.includes('ok'));

      if (isSuccess) {
        console.log(`🎉 SUCCESS! WhatsApp sent to ${phone12}`);
        return { ok: true, response: res.data };
      }

      lastError = new Error(`HTTP ${res.status}: ${resStr}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('WAPI Access Token Send Failed');
}

// ==============================
// PUBLIC FUNCTION
// ==============================
async function sendDirectWhatsAppMessage(phone, order = {}) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) {
      console.log('⚠️ WhatsApp skipped: invalid phone', phone);
      return { ok: false, error: 'invalid_phone' };
    }

    // Dine-in table start (pending) pe mat bhejo
    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      console.log('⚠️ WhatsApp skipped: pending payment order');
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
  toWhatsAppNumber,
  get10Digits,
};