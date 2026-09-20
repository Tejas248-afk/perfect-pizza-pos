/**
 * Powerstext WhatsApp API Helper (POST Method with Form-UrlEncoded Body)
 */
async function sendDirectWhatsAppMessage(phone, order) {
  try {
    console.log(`📱 [WhatsApp Helper] Called for Phone: "${phone}"`);

    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

    if (cleanPhone.length >= 10) {
      cleanPhone = '91' + cleanPhone.slice(-10); // Exact 91 + 10 Digits
    } else {
      console.log(`⚠️ [WhatsApp Helper] Skipped: Phone "${phone}" is invalid.`);
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

    const authenticKey = process.env.POWERSTEXT_KEY || '35315065726665637450697a7a615748415450503130301765611474';
    const routeId = process.env.POWERSTEXT_ROUTE || '1';

    // 🔥 FORM-URLENCODED DATA AS PER CLIENT DOCS
    const formData = new URLSearchParams();
    formData.append('authentic-key', authenticKey);
    formData.append('tokenkey', authenticKey);
    formData.append('routeid', routeId);
    formData.append('number', cleanPhone);
    formData.append('message', messageText);

    const apiUrl = 'http://wapp.powerstext.in/http-tokenkeyapi.php';

    console.log(`🚀 [WhatsApp Helper] Sending POST request to Powerstext for ${cleanPhone}...`);

    // POST Request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const responseData = await response.text();
    console.log(`📩 [WhatsApp Helper] Response from Powerstext (${cleanPhone}):`, responseData);

  } catch (error) {
    console.error('❌ [WhatsApp Helper] Error:', error.message);
  }
}

module.exports = { sendDirectWhatsAppMessage };