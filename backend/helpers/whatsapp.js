const axios = require('axios');

const POWERSTEXT_ENDPOINT = 'http://wapp.powerstext.in/http-tokenkeyapi.php';
const AUTHENTIC_KEY = process.env.POWERSTEXT_AUTH_KEY || '35315065726665637450697a7a615748415450503130301765611474';
const ROUTE_ID = process.env.POWERSTEXT_ROUTE || '1';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

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
 * Direct Powerstext TokenKey API Sender
 */
async function sendViaPowerstext(to91, message) {
  // Param combinations for tokenkeyapi.php
  const paramVariations = [
    { 'authentic-key': AUTHENTIC_KEY, route: ROUTE_ID, number: to91, message: message },
    { 'authentic-key': AUTHENTIC_KEY, route: ROUTE_ID, to: to91, message: message },
    { 'authentic-key': AUTHENTIC_KEY, route: ROUTE_ID, mobile: to91, msg: message },
    { 'authentic-key': AUTHENTIC_KEY, route: ROUTE_ID, phone: to91, message: message }
  ];

  let lastError = null;

  for (const params of paramVariations) {
    try {
      const res = await axios.get(POWERSTEXT_ENDPOINT, {
        params: params,
        timeout: 10000,
        validateStatus: () => true
      });

      const resStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data || '');
      console.log(`📡 Powerstext TokenKey API Response -> Status: ${res.status} | Res: ${resStr}`);

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, response: res.data };
      } else {
        lastError = new Error(`HTTP ${res.status}: ${resStr}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Powerstext TokenKey API call failed');
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
    console.log(`📲 Sending WA Message via TokenKey API to ${to91}...`);
    const result = await sendViaPowerstext(to91, message);

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