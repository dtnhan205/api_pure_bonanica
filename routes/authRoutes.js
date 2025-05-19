const express = require('express');
const { googleAuth, googleAuthCallback } = require('../controllers/googleAuthController');
const router = express.Router();

// Đăng nhập bằng Google
router.get('/auth/google', googleAuth);

// Callback sau khi đăng nhập Google
router.get('/auth/google/callback', googleAuthCallback);

// Đăng xuất
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Lỗi đăng xuất:', err.message, err.stack);
      return res.status(500).json({ message: 'Lỗi đăng xuất', error: err.message });
    }
    // Xóa session
    req.session.destroy((err) => {
      if (err) {
        console.error('Lỗi xóa session:', err.message, err.stack);
        return res.status(500).json({ message: 'Lỗi xóa session', error: err.message });
      }
      res.redirect(process.env.BASE_URL || 'http://localhost:3000');
    });
  });
});

module.exports = router;