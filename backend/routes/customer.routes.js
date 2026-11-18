const express = require('express');
const router = express.Router();
const {
  getCustomers,
  syncCustomersFromOrders,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customer.controller');

// Static routes first
router.get('/', getCustomers);
router.post('/', createCustomer);
router.post('/sync', syncCustomersFromOrders);
router.get('/sync', syncCustomersFromOrders);

// Parameterized routes last
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;