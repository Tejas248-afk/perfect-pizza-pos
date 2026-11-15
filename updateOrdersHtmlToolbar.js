const fs = require('fs');
const path = require('path');

const ordersHtmlPath = path.join(__dirname, 'frontend', 'orders.html');
let html = fs.readFileSync(ordersHtmlPath, 'utf8');

const toolbarTarget = `<div class="orders-toolbar">
    <div class="filter-tabs">
      <button class="tab active" data-status="active">⚡ Active</button>
      <button class="tab" data-status="completed">✅ Completed</button>
      <button class="tab" data-status="cancelled">❌ Cancelled</button>
      <button class="tab" data-status="all">📅 All Today</button>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 12px; color: #10B981; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
        <span style="width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite;"></span>
        Auto-Sync 10s
      </span>
      <button class="btn-refresh" onclick="loadOrders(false)">🔄 Refresh</button>
    </div>
  </div>`;

if (html.includes('<div class="orders-toolbar">')) {
  html = html.replace(/<div class="orders-toolbar">[\s\S]*?<\/div>/, toolbarTarget);
  fs.writeFileSync(ordersHtmlPath, html, 'utf8');
  console.log('✅ Updated Toolbar in orders.html');
}
