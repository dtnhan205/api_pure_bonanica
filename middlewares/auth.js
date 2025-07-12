const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("No token provided in headers:", req.headers);
    return res.status(401).json({ error: 'Không có token xác thực' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
    console.log("Decoded token:", decoded); // Debug
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      console.log("User not found for id:", decoded.id); // Debug
      return res.status(401).json({ error: 'Người dùng không tồn tại' });
    }

    req.user = user;
    console.log("Assigned req.user:", {
      id: user._id.toString(),
      role: user.role,
    }); // Debug
    next();
  } catch (err) {
    console.error("Lỗi trong authMiddleware:", err); // Debug
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    return res.status(500).json({ error: 'Lỗi server trong authMiddleware', details: err.message });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    console.log("Access denied in isAdmin:", { user: req.user ? req.user.role : null });
    return res.status(403).json({ error: 'Chỉ admin có quyền truy cập' });
  }
  next();
};

module.exports = { authMiddleware, isAdmin };