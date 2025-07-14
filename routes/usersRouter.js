const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { googleAuth, googleAuthCallback } = require('../controllers/googleAuthController');
const jwt = require('jsonwebtoken');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

const combinedAuthMiddleware = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] Combined auth middleware - ${req.method} ${req.url}`, { user: req.user });
  if (req.user && req.user._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
    console.log('Using Passport user:', { id: req.user._id, role: req.user.role });
    next();
  } else {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Không có token xác thực' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
      console.log('Decoded JWT:', decoded);
      req.user = { _id: decoded.id, role: decoded.role }; // Gán từ token
      next();
    } catch (err) {
      console.error('Lỗi xác thực JWT:', err);
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
  }
};

// Áp dụng cho các route cần xác thực
router.get('/favorite-products', combinedAuthMiddleware, userController.getFavoriteProducts);
router.get('/userinfo', combinedAuthMiddleware, userController.getUser);
router.get('/temporary-addresses', combinedAuthMiddleware, userController.getTemporaryAddresses);
router.get('/', combinedAuthMiddleware, isAdmin, userController.getAllUsers);
router.get('/:id', combinedAuthMiddleware, isAdmin, userController.getUserById);
router.post('/favorite-products', combinedAuthMiddleware, userController.addFavoriteProduct);
router.delete('/favorite-products/:productId', combinedAuthMiddleware, userController.removeFavoriteProduct);
router.put('/update/:id', combinedAuthMiddleware, userController.updateUser);
router.delete('/:id', combinedAuthMiddleware, isAdmin, userController.deleteUser);
router.put('/change-password/:id', combinedAuthMiddleware, userController.changePassword);

// Giữ nguyên route không cần JWT
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password/:token', userController.resetPassword);
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback);

module.exports = router;