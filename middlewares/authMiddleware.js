const jwt = require('jsonwebtoken');
const User = require('../models/user'); 

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Không có token xác thực:', authHeader);
    return res.status(401).json({ error: 'Không có token xác thực' });
  }

  const token = authHeader.split(' ')[1];

  try {
    console.log('Token nhận được:', token);
    console.log('JWT_SECRET:', process.env.JWT_SECRET || 'your-secret-key');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Token giải mã:', decoded);
    const user = await User.findById(decoded.id).select('-password'); 

    if (!user) {
      console.log('Người dùng không tồn tại:', decoded.id);
      return res.status(401).json({ error: 'Người dùng không tồn tại' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log('Lỗi xác thực token:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn' });
    }
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

module.exports = authMiddleware;