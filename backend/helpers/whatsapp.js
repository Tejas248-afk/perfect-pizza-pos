const axios = require('axios');

/**
 * Custom WhatsApp Gateway Sender
 * @param {string} phone - Customer 10-digit mobile number
 * @param {object} order - Order object containing details
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      cleanPhone = cleanPhone.slice(-10); // Exact 10 digits
    } else {
      console.log('⚠️ WhatsApp Skipped: Invalid phone number ->', phone);
      return;
    }

    const name = order.customerName || order.customer?.name || 'Valued Customer';
    const amount = order.grandTotal || 0;
    const trackerUrl = `https://perfect-pizza-pos.netlify.app/track.html?id=${order._id}`;

    // WhatsApp Message Content
    const messageText = `🙏 Thank You for Ordering from *Perfect Pizza!* 🍕

Dear *${name}*,
Your delicious order has been received! 🍕🛵

🧾 *Invoice Details*
━━━━━━━━━━━━━━
👤 *Customer:* ${name}
🧾 *Invoice No:* ${order.orderNumber}
💰 *Total Payable:* ₹${amount}
🛵 *Order Type:* ${(order.orderType || 'Takeaway').toUpperCase()}
━━━━━━━━━━━━━━

🧾 *Track Your Order Live:*
${trackerUrl}

📞 *Contact:* 9889229198
📍 *Perfect Pizza, Kalyanpur*

✨ *Hot, Fresh & Perfect Every Time!*`;

    const authenticKey = '35315065726665637450697a7a615748415450503130301765611474';
    const encodedMessage = encodeURIComponent(messageText);

    // Client's HTTP Gateway API URL
    const apiUrl = `http://wapp.powerstext.in/http-tokenkeyapi.php?authentic-key=${authenticKey}&route=1&number=${cleanPhone}&message=${encodedMessage}`;

    // Async Non-blocking Request
    const response = await axios.get(apiUrl);
    console.log(`✅ Direct WhatsApp Gateway Response for ${cleanPhone}:`, response.data);

  } catch (error) {
    console.error('❌ WhatsApp Gateway API Error:', error.message);
  }
}

module.exports = { sendDirectWhatsAppMessage };