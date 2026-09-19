const express = require('express');
const router = express.Router();
const { 
  getTables, 
  seedTables, 
  assignOrderToTable, 
  clearTable 
} = require('../controllers/table.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getTables);
router.post('/seed', protect, seedTables);
router.patch('/:id/assign', protect, assignOrderToTable);
router.patch('/:id/clear', protect, clearTable);

module.exports = router;