const express = require('express');
const router = express.Router();
const { getFullMenu, toggleProductAvailability } = require('../controllers/menu.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', getFullMenu);
router.patch('/products/:id/toggle', protect, authorize('super-admin', 'admin'), toggleProductAvailability);

module.exports = router;