const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');

const cleanNav = `<div class="user-info">
      <a href="pos.html" class="btn-orders-nav btn-nav-yellow">POS Billing</a>
      <a href="orders.html" class="btn-orders-nav btn-nav-dark">Orders</a>
      <a href="kitchen.html" target="_blank" class="btn-orders-nav btn-nav-dark">Kitchen</a>
      <a href="tables.html" class="btn-orders-nav btn-nav-yellow">Tables</a>
      <a href="menu-manager.html" class="btn-orders-nav" style="background:#8B5CF6;">Menu</a>
      <a href="reports.html" class="btn-orders-nav btn-nav-blue">Reports</a>
      <a href="customers.html" class="btn-orders-nav" style="background:#10B981;">Customers</a>
      <a href="settings.html" class="btn-orders-nav" style="background:#64748B;">Settings</a>
    </div>`;

if (fs.existsSync(frontendDir)) {
  const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));
  files.forEach(file => {
    const filePath = path.join(frontendDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace user-info div with clean Nav
    if (content.includes('<div class="user-info">')) {
      content = content.replace(/<div class="user-info">[\s\S]*?<\/div>/i, cleanNav);
    }

    // Clean Mojibake and corrupted UTF-8 sequences across the file
    content = content
      .replace(/CafÃ©/g, 'Cafe')
      .replace(/ðŸ[^\s<"]*/g, '')
      .replace(/âš[^\s<"]*/g, '')
      .replace(/â[^\s<"]*/g, '')
      .replace(/Â/g, '')
      .replace(/ï¸/g, '');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Cleaned encoding in: ${file}`);
  });
} else {
  console.error('❌ Frontend directory not found');
}
