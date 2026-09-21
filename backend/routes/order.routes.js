const express = require('express');
const router = express.Router();

const {
  createOrder,
  lookupCustomer,
  getOrders,
  getOrderById,
  updateOrderStatus,
  addKotItems
} = require('../controllers/order.controller');

// 🔴 VERY IMPORTANT: Specific routes MUST come before generic /:id routes!

// 1. GET /api/orders/customer/:phone
router.get('/customer/:phone', lookupCustomer);

// 2. GET /api/orders
router.get('/', getOrders);

// 3. POST /api/orders
router.post('/', createOrder);

// 4. GET /api/orders/:id
router.get('/:id', getOrderById);

// 5. PATCH /api/orders/:id/status
router.patch('/:id/status', updateOrderStatus);

// 6. PATCH /api/orders/:id/add-items (For Dine-In KOT)
router.patch('/:id/add-items', addKotItems);

module.exports = router;