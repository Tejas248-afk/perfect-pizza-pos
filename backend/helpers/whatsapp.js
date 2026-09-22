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
 * Multi-Endpoint Fallback Sender for Powerstext PHP Panel
 */
async function sendViaPowerstext(to91, message) {
  // Common endpoints used by Indian WhatsApp PHP API Panels
  const attempts = [
    // 1. GET request to /api/send.php (Most Common for PHP Panels)
    {
      method: 'GET',
      url: `${POWERSTEXT_BASE_URL}/api/send.php`,
      params: {
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        number: to91,
        message: message,
      },
    },
    // 2. GET request to /api/send-message.php
    {
      method: 'GET',
      url: `${POWERSTEXT_BASE_URL}/api/send-message.php`,
      params: {
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        to: to91,
        message: message,
      },
    },
    // 3. GET request to /api/send
    {
      method: 'GET',
      url: `${POWERSTEXT_BASE_URL}/api/send`,
      params: {
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        number: to91,
        message: message,
      },
    },
    // 4. POST Form-Urlencoded to /api/send.php
    {
      method: 'POST',
      url: `${POWERSTEXT_BASE_URL}/api/send.php`,
      data: new URLSearchParams({
        username: POWERSTEXT_USER,
        password: POWERSTEXT_PASS,
        number: to91,
        message: message,
      }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    // 5. GET request to /send_message
    {
      method: 'GET',
      url: `${POWERSTEXT_BASE_URL}/send_message`,
      params: {
        user: POWERSTEXT_USER,
        pass: POWERSTEXT_PASS,
        phone: to91,
        text: message,
      },
    }
  ];

  let lastError = null;

  for (const config of attempts) {
    try {
      const res = await axios({
        method: config.method,
        url: config.url,
        params: config.params || undefined,
        data: config.data || undefined,
        headers: config.headers || undefined,
        timeout: 12000,
        validateStatus: () => true,
      });

      // Ignore 404s and try next endpoint in loop
      if (res.status === 404) {
        continue;
      }

      const responseText = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);

      const isSuccess =
        res.status >= 200 &&
        res.status < 300 &&
        !responseText.includes('404 Not Found') &&
        (
          res.data?.status === 'success' ||
          res.data?.status === true ||
          res.data?.success === true ||
          responseText.toLowerCase().includes('sent') ||
          responseText.toLowerCase().includes('success') ||
          responseText.includes('200')
        );

      if (isSuccess || (res.status >= 200 && res.status < 300)) {
        console.log(`✅ Powerstext Success via ${config.url} | Status: ${res.status}`);
        return { ok: true, response: res.data };
      } else {
        lastError = new Error(`Powerstext response (${res.status}): ${responseText.slice(0, 150)}`);
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