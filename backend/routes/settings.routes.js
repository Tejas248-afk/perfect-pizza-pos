const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Settings
router.get('/', protect, getSettings);
router.put('/', protect, authorize('super-admin', 'admin'), updateSettings);

// Staff
router.get('/staff', protect, authorize('super-admin', 'admin'), getStaff);
router.post('/staff', protect, authorize('super-admin', 'admin'), addStaff);
router.put('/staff/:id', protect, authorize('super-admin', 'admin'), updateStaff);
router.delete('/staff/:id', protect, authorize('super-admin', 'admin'), deleteStaff);

module.exports = router;