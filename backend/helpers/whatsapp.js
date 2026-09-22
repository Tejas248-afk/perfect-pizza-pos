const axios = require('axios');

const POWERSTEXT_USER = process.env.POWERSTEXT_USER || 'PerfectPizzaWHATPP';
const POWERSTEXT_PASS = process.env.POWERSTEXT_PASS || 'edf65';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

// Cache the working endpoint once discovered
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

  const billNo = order?.orderNumber || '-';
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
 * Smart Auto-Discovery WhatsApp Sender for Powerstext Panel
 */
async function sendViaPowerstext(to91, message) {
  // If we already know the working endpoint, use it directly
  if (WORKING_ENDPOINT_CACHE) {
    try {
      const res = await axios({
        method: WORKING_ENDPOINT_CACHE.method,
        url: WORKING_ENDPOINT_CACHE.url,
        params: WORKING_ENDPOINT_CACHE.getParams(to91, message),
        timeout: 10000,
        validateStatus: () => true
      });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, response: res.data };
      }
    } catch (e) {
      console.log("⚠️ Cached endpoint failed, retrying auto-discovery...");
      WORKING_ENDPOINT_CACHE = null;
    }
  }

  // List of all possible Powerstext PHP API Endpoints & Protocols
  const bases = ['http://wapp.powerstext.in', 'https://wapp.powerstext.in'];
  const paths = [
    '/api/sendtext.php',
    '/api/send.php',
    '/api/sendhttp.php',
    '/api/send_message.php',
    '/api/whatsapp.php',
    '/api/sendtext',
    '/api/send',
    '/send-message'
  ];

  const paramTemplates = [
    (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, to: num, message: msg }),
    (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, number: num, message: msg }),
    (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, mobile: num, message: msg }),
    (num, msg) => ({ user: POWERSTEXT_USER, pass: POWERSTEXT_PASS, mobiles: num, message: msg }),
    (num, msg) => ({ username: POWERSTEXT_USER, password: POWERSTEXT_PASS, to: num, message: msg })
  ];

  let candidates = [];
  for (const base of bases) {
    for (const path of paths) {
      for (const getParams of paramTemplates) {
        candidates.push({ method: 'GET', url: base + path, getParams });
      }
    }
  }

  let lastError = null;

  for (const candidate of candidates) {
    const queryParams = candidate.getParams(to91, message);
    try {
      const res = await axios({
        method: candidate.method,
        url: candidate.url,
        params: queryParams,
        timeout: 8000,
        validateStatus: () => true
      });

      if (res.status === 404) {
        continue; // Try next URL silently
      }

      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');

      // Check if response indicates success
      if (res.status >= 200 && res.status < 300 && !resStr.includes('404 Not Found')) {
        console.log(`🎯 Powerstext Working Endpoint Discovered! -> ${candidate.url}`);
        WORKING_ENDPOINT_CACHE = candidate; // Cache for next orders!
        return { ok: true, response: res.data };
      } else {
        lastError = new Error(`Status ${res.status}: ${resStr.slice(0, 100)}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Powerstext endpoints returned 404/Error');
}

/**
 * Main function called by Order Controller
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const to91 = toWhatsAppNumber(phone);
    if (!to91) {
      console.log('⚠️ WhatsApp skipped: invalid phone', phone);
      return { skipped: true, reason: 'invalid_phone' };
    }

    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      console.log('⚠️ WhatsApp skipped: pending payment order');
      return { skipped: true, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    const result = await sendViaPowerstext(to91, message);

    console.log(`✅ WhatsApp Invoice Sent -> ${to91} | Order: ${order?.orderNumber}`);
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