const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { googleAuth, googleAuthCallback } = require('../controllers/googleAuthController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

// Đăng ký
router.post('/register', userController.register);

// Đăng nhập
router.post('/login', userController.login);

// Quên mật khẩu
router.post('/forgot-password', userController.forgotPassword);

// Đặt lại mật khẩu
router.post('/reset-password/:token', userController.resetPassword);

// Lấy thông tin người dùng (yêu cầu token)
router.get('/userinfo', authMiddleware, userController.getUser);

// Lấy tất cả người dùng (yêu cầu token và quyền admin)
router.get('/', authMiddleware, isAdmin, userController.getAllUsers);

// Lấy thông tin người dùng theo ID (yêu cầu token và quyền admin)
router.get('/:id', authMiddleware, isAdmin, userController.getUserById);

// Cập nhật thông tin người dùng (yêu cầu token)
router.put('/update/:id', authMiddleware, userController.updateUser);

// Xóa người dùng (yêu cầu token và quyền admin)
router.delete('/:id', authMiddleware, isAdmin, userController.deleteUser);

// Đổi mật khẩu (yêu cầu token, admin hoặc chính người dùng)
router.put('/change-password/:id', authMiddleware, userController.changePassword);

// Đăng nhập bằng Google
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback);

module.exports = router;