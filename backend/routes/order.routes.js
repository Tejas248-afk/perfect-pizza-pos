const express = require('express');
const router = express.Router();

const {
  createOrder,
  lookupCustomer,
  getOrders,
  getOrderById,
  updateOrderStatus,
  addKotItems,
  testWhatsApp
} = require('../controllers/order.controller');

// 🔴 SPECIFIC ROUTES MUST COME BEFORE GENERIC /:id ROUTES!

// 1. WhatsApp Test Route (Browser me direct kholne ke liye bina token ke)
router.get('/test-whatsapp', testWhatsApp);

// 2. Customer Lookup
router.get('/customer/:phone', lookupCustomer);

// 3. Fetch All Orders
router.get('/', getOrders);

// 4. Create Order
router.post('/', createOrder);

// 🔴 PARAMETER / ID ROUTES MUST COME LAST!
// 5. Get Order By ID
router.get('/:id', getOrderById);

// 6. Update Status
router.patch('/:id/status', updateOrderStatus);

// 7. Add KOT Items
router.patch('/:id/add-items', addKotItems);

module.exports = router;