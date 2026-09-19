const express = require('express');
const router = express.Router();
const { getSummaryReport } = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/summary', protect, getSummaryReport);

module.exports = router;