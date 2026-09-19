const express = require('express');
const router = express.Router();
const { loginUser, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/login', loginUser);
router.get('/me', protect, getMe);

module.exports = router;