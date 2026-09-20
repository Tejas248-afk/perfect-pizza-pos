/**
 * Custom WhatsApp Gateway Sender (Powerstext API)
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    console.log(`📱 [WhatsApp Helper] Called for Phone: "${phone}"`);

    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

    if (cleanPhone.length >= 10) {
      cleanPhone = '91' + cleanPhone.slice(-10); // India Prefix
    } else {
      console.log(`⚠️ [WhatsApp Helper] Skipped: Phone "${phone}" is invalid or less than 10 digits.`);
      return;
    }

    const name = order.customerName || order.customer?.name || 'Valued Customer';
    const amount = order.grandTotal || 0;
    const trackerUrl = `https://perfect-pizza-pos.netlify.app/track.html?id=${order._id}`;

    // Message Text
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

    const apiUrl = `http://wapp.powerstext.in/http-tokenkeyapi.php?authentic-key=${authenticKey}&route=1&number=${cleanPhone}&message=${encodedMessage}`;

    console.log(`🚀 [WhatsApp Helper] Sending request to Powerstext API for ${cleanPhone}...`);

    const response = await fetch(apiUrl);
    const responseData = await response.text();

    console.log(`📩 [WhatsApp Helper] Response from Powerstext (${cleanPhone}):`, responseData);

  } catch (error) {
    console.error('❌ [WhatsApp Helper] Error:', error.message);
  }
}

module.exports = { sendDirectWhatsAppMessage };