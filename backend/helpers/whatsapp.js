const axios = require('axios');
const Customer = require('../models/Customer');

// ==============================
// CONFIG
// ==============================
const API_TOKEN = process.env.POWERSTEXT_TOKEN || 'fb8f9c05b518a';
const WAPI_SEND_URL = 'https://wapi.powerstext.in/api/send';
const INVOICE_BASE_URL = (process.env.INVOICE_BASE_URL || 'https://pizzapos.netlify.app').replace(/\/$/, '');

// 🛑 ANTI-DUPLICATE CACHE (Locks Order ID for 2 Minutes)
const SENT_CACHE = new Set();

function isDuplicateCall(orderIdOrNum, isCancellation) {
  if (!orderIdOrNum) return false;
  const key = `${orderIdOrNum}_${isCancellation ? 'cancel' : 'invoice'}`;
  
  if (SENT_CACHE.has(key)) {
    return true; // DUPLICATE DETECTED!
  }

  SENT_CACHE.add(key);
  setTimeout(() => SENT_CACHE.delete(key), 120000); // 2 Min Lock
  return false;
}

// ==============================
// HELPERS
// ==============================
function get10Digits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  return last10.length === 10 ? last10 : null;
}

// 1. Invoice Message Template (WITH TOTAL REWARD POINTS)
function buildInvoiceMessage(order = {}, totalCoins = null) {
  const name =
    order?.customer?.name && String(order.customer.name).toLowerCase() !== 'guest'
      ? order.customer.name
      : 'Customer';

  const billNo = order?.orderNumber || 'ORD-101';
  const amount = Number(order?.grandTotal || 0);
  const paidAmount = String(order?.paymentMethod || '').toLowerCase() === 'pending' ? 0 : amount;
  const rewardPointsEarned = Number(order?.rewardCoinsEarned || 0);
  
  // Total Coins Balance: live balance passed or calculated
  const totalRewardPoints = totalCoins != null ? Number(totalCoins) : rewardPointsEarned;

  const invoiceLink = order?._id
    ? `${INVOICE_BASE_URL}/invoice.html?id=${order._id}`
    : `${INVOICE_BASE_URL}`;

  return (
`🙏 Thank You for Ordering from Perfect Pizza! 🍕

Dear *${name}*,
Your delicious order has been received! 🍕🛵

🧾 *Order ID:* ${billNo}
💰 *Amount Paid:* ₹${paidAmount}
🎁 *Reward Points Earned:* ${rewardPointsEarned}
🎁 *Total Reward Points:* ${totalRewardPoints}

📲 *Download Our App:*
Perfect Pizza-Food Delivery
👉 https://t.ly/kbCgq

🎉 *FLAT ₹100 OFF* on orders above ₹299.
✅ *Valid on your FIRST 5 ONLINE ORDERS!*

🌐 *Order Now:* https://perfectpizzas.in/

🧾 *Invoice:* ${invoiceLink}

📞 9889229198
📍 Singhpur Chauraha, Bithoor Rd, Kalyanpur, Kanpur

✨ *Thank you for choosing Perfect Pizza!*
*Hot, Fresh & Perfect Every Time!* 🍕❤️`
  );
}

// 2. Cancellation Message Template
function buildCancellationMessage(order = {}) {
  const name =
    order?.customer?.name && String(order.customer.name).toLowerCase() !== 'guest'
      ? order.customer.name
      : 'Customer';
  const billNo = order?.orderNumber || '-';

  return (
`❌ *Order Cancelled* 🍕

Dear *${name}*,
Your order *#${billNo}* at *Perfect Pizza* has been cancelled.

If you have any questions or this was done by mistake, please contact us.

📞 *Contact:* 9889229198
📍 *Perfect Pizza, Kalyanpur*`
  );
}

// ==============================
// PUBLIC SENDER
// ==============================
async function sendDirectWhatsAppMessage(phone, order = {}, isCancellation = false) {
  try {
    const phone10 = get10Digits(phone);
    if (!phone10) return { ok: false, error: 'invalid_phone' };

    // Dine-in table start (pending) pe mat bhejo
    if (!isCancellation && String(order?.paymentMethod || '').toLowerCase() === 'pending') {
      return { ok: false, reason: 'pending_payment' };
    }

    // 🛑 DEDUPLICATION CHECK
    const orderId = order?._id || order?.orderNumber || Date.now();
    if (isDuplicateCall(orderId, isCancellation)) {
      console.log(`🛑 DUPLICATE BLOCKED: WhatsApp already sent for ${orderId}`);
      return { ok: true, skipped: 'duplicate_prevented' };
    }

    // 🪙 LIVE REWARD COINS BALANCE FETCH
    let totalCoins = 0;
    try {
      const cust = await Customer.findOne({
        $or: [
          { phone: phone10 },
          { phone: { $regex: phone10 + '$', $options: 'i' } }
        ]
      }).lean();

      if (cust) {
        totalCoins = Number(cust.rewardCoins || 0);
        // Agar order abhi 'new' hai aur coinsAwarded nahi hua, toh earned coins ko add karke total dikhao
        if (!order.coinsAwarded && order.rewardCoinsEarned) {
          totalCoins += Number(order.rewardCoinsEarned);
        }
      } else {
        totalCoins = Number(order.rewardCoinsEarned || 0);
      }
    } catch (dbErr) {
      console.error("Coins fetch error:", dbErr.message);
      totalCoins = Number(order.rewardCoinsEarned || 0);
    }

    const phone12 = `91${phone10}`;
    const message = isCancellation ? buildCancellationMessage(order) : buildInvoiceMessage(order, totalCoins);

    console.log(`🚀 Sending WhatsApp -> Phone: ${phone12} | Order: ${order?.orderNumber || 'N/A'} | Coins: ${totalCoins}`);

    const res = await axios.get(WAPI_SEND_URL, {
      params: {
        access_token: API_TOKEN,
        number: phone12,
        message: message,
      },
      timeout: 12000,
      validateStatus: () => true,
    });

    const resData = res.data;
    console.log(`📡 WAPI API Response:`, JSON.stringify(resData));

    return { ok: true, response: resData };
  } catch (err) {
    console.error('❌ WhatsApp Send Error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  buildCancellationMessage,
  toWhatsAppNumber: get10Digits,
  get10Digits,
};