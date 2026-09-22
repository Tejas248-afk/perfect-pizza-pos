const axios = require('axios');

const POWERSTEXT_ENDPOINT = 'http://wapp.powerstext.in/http-tokenkeyapi.php';
const AUTHENTIC_KEY = '35315065726665637450697a7a615748415450503130301765611474';
const ROUTE_ID = '1';
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
 * Direct Powerstext TokenKey API Sender
 */
async function sendViaPowerstext(to91, message) {
  try {
    // Strict parameters according to Powerstext Token API Documentation
    const params = {
      'authentic-key': AUTHENTIC_KEY,
      'route': ROUTE_ID,
      'number': to91,
      'message': message
    };

    const res = await axios.get(POWERSTEXT_ENDPOINT, { 
      params,
      timeout: 15000,
      validateStatus: () => true 
    });

    const resData = res.data;
    console.log(`📡 WA API Response -> Status: ${res.status} | Body:`, JSON.stringify(resData));

    // Powerstext specific success check
    if (res.status === 200 && (resData.Status === 'Success' || resData.status === 'success')) {
      return { ok: true, response: resData };
    } else {
      // Return false if API rejected the request even with HTTP 200
      return { ok: false, error: resData.Description || 'API Authentication Failed', response: resData };
    }
  } catch (err) {
    console.error('❌ WA API Connection Error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function sendDirectWhatsAppMessage(phone, order) {
  try {
    const to91 = toWhatsAppNumber(phone);
    if (!to91) return { ok: false, error: 'invalid_phone' };

    const message = buildInvoiceMessage(order);
    const result = await sendViaPowerstext(to91, message);

    if (result.ok) {
      console.log(`✅ WhatsApp Sent to ${to91}`);
    } else {
      console.log(`❌ WhatsApp Failed for ${to91}: ${result.error}`);
    }
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendDirectWhatsAppMessage,
  buildInvoiceMessage,
  toWhatsAppNumber,
};