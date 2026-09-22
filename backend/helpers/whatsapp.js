const axios = require('axios');

const POWERSTEXT_BASE_URL = (process.env.POWERSTEXT_BASE_URL || 'https://wapp.powerstext.in').replace(/\/$/, '');
const POWERSTEXT_USER = process.env.POWERSTEXT_USER || 'PerfectPizzaWHATPP';
const POWERSTEXT_PASS = process.env.POWERSTEXT_PASS || 'edf65';
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

  // Invoice link (optional page). Agar invoice page nahi hai to bhi chalega.
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
 * Powerstext sender
 * Common endpoint patterns try karta hai.
 */
async function sendViaPowerstext(to91, message) {
  const payloads = [
    // Pattern A
    {
      url: `${POWERSTEXT_BASE_URL}/api/send`,
      data: {
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        number: to91,
        message,
      },
    },
    // Pattern B
    {
      url: `${POWERSTEXT_BASE_URL}/api/sendText`,
      data: {
        user: POWERSTEXT_USER,
        pass: POWERSTEXT_PASS,
        to: to91,
        msg: message,
      },
    },
    // Pattern C (query style some panels use)
    {
      url: `${POWERSTEXT_BASE_URL}/api/send`,
      data: null,
      params: {
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        to: to91,
        message,
      },
    },
  ];

  let lastError = null;

  for (const item of payloads) {
    try {
      const res = await axios({
        method: 'POST',
        url: item.url,
        data: item.data || undefined,
        params: item.params || undefined,
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      });

      // success heuristics
      const ok =
        res.status >= 200 &&
        res.status < 300 &&
        (res.data?.success === true ||
          res.data?.status === 'success' ||
          res.data?.status === true ||
          String(res.data?.message || '').toLowerCase().includes('success') ||
          typeof res.data === 'string' && res.data.toLowerCase().includes('success') ||
          res.status === 200);

      if (ok) {
        return { ok: true, providerResponse: res.data, status: res.status };
      }

      lastError = new Error(
        `Powerstext failed (${res.status}): ${JSON.stringify(res.data)}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Powerstext send failed');
}

/**
 * Main function used by order controller
 * @param {string} phone
 * @param {object} order
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const to91 = toWhatsAppNumber(phone);
    if (!to91) {
      console.log('⚠️ WhatsApp skipped: invalid phone', phone);
      return { skipped: true, reason: 'invalid_phone' };
    }

    // pending table open pe mat bhejo
    if (String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      console.log('⚠️ WhatsApp skipped: pending payment order');
      return { skipped: true, reason: 'pending_payment' };
    }

    const message = buildInvoiceMessage(order);
    const result = await sendViaPowerstext(to91, message);

    console.log(`✅ WhatsApp invoice sent to ${to91} | Bill: ${order?.orderNumber}`);
    return result;
  } catch (err) {
    // Order create fail na ho isliye error swallow + log
    console.error('❌ WhatsApp send error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber,
};