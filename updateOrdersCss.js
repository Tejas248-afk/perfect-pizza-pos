const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend', 'css', 'orders.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Update .orders-list style to enable independent smooth scrolling
const updatedScrollStyle = `.orders-list {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  background: var(--bg);
  height: calc(100vh - 135px);
  overflow-y: auto;
  align-content: start;
  scroll-behavior: smooth;
}`;

if (cssContent.includes('.orders-list {')) {
  cssContent = cssContent.replace(/\.orders-list\s*\{[\s\S]*?\}/, updatedScrollStyle);
} else {
  cssContent += '\n' + updatedScrollStyle;
}

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('✅ Enabled smooth scrolling in css/orders.css');
