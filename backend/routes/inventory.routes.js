const express = require('express');
const router = express.Router();
const { getInventory, addItem, addStockLog } = require('../controllers/inventory.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getInventory);
router.post('/', protect, addItem);
router.post('/:id/log', protect, addStockLog);

module.exports = router;