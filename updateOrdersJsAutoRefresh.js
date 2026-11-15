const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'frontend', 'js', 'orders.js');
let js = fs.readFileSync(jsPath, 'utf8');

// Ensure silent auto refresh timer is active at end of orders.js
if (!js.includes('// AUTO_REFRESH_TIMER_SET')) {
  js += `\n\n// AUTO_REFRESH_TIMER_SET
if (window.ordersAutoRefreshInterval) clearInterval(window.ordersAutoRefreshInterval);
window.ordersAutoRefreshInterval = setInterval(() => {
  if (typeof loadOrders === 'function') {
    loadOrders(true);
  }
}, 10000);
`;
  fs.writeFileSync(jsPath, js, 'utf8');
  console.log('✅ Added 10s Silent Auto-Refresh to js/orders.js');
} else {
  console.log('ℹ️ Auto-refresh timer already present');
}
