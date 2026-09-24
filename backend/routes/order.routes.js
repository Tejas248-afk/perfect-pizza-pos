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

// 🔴 SPECIFIC & PUBLIC ROUTES (MUST COME BEFORE GENERIC /:id ROUTES!)

// 1. Public Invoice View Route (For WhatsApp Link - Unprotected Access)
router.get('/public/:id', getOrderById);

// 2. WhatsApp Test Route (Browser me direct test karne ke liye)
router.get('/test-whatsapp', testWhatsApp);

// 3. Customer Lookup
router.get('/customer/:phone', lookupCustomer);

// 4. Fetch All Orders
router.get('/', getOrders);

// 5. Create Order
router.post('/', createOrder);

// 🔴 PARAMETER / ID ROUTES (MUST COME LAST!)

// 6. Get Order By ID
router.get('/:id', getOrderById);

// 7. Update Status
router.patch('/:id/status', updateOrderStatus);

// 8. Add KOT Items
router.patch('/:id/add-items', addKotItems);

module.exports = router;