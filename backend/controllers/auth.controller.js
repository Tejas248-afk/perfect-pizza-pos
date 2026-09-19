const User = require('../models/User');
const Branch = require('../models/Branch'); // 👈 Ye line add ki hai
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in .env file');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Auth User & Get Token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Please provide phone number and password' });
    }

    // Find user by phone
    const user = await User.findOne({ phone }).populate('branch');

    if (!user) {
      return res.status(401).json({ message: 'User not found with this phone number' });
    }

    const isMatch = await user.matchPassword(password);

    if (isMatch) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated. Contact admin.' });
      }

      res.json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        branch: user.branch,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid phone number or password' });
    }
  } catch (error) {
    console.error('❌ Login Error Details:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Current Logged in User Profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('branch');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginUser,
  getMe,
};