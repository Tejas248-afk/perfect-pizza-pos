const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id)
        .select('-password')
        .populate('branch');

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ message: 'User not authorized or inactive' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Token failed, authorization denied' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }
};

// Role Check Middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };