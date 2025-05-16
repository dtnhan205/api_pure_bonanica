const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');


// userController.authLimiter 

// Đăng ký
router.post('/register', userController.register);

// Đăng nhập
router.post('/login', userController.login);

// Xác thực email
router.get('/verify-email/:token', userController.verifyEmail);

// Quên mật khẩu
router.post('/forgot-password', userController.forgotPassword);

// Đặt lại mật khẩu
router.post('/reset-password/:token', userController.resetPassword);

// Lấy thông tin user (yêu cầu token)
router.get('/userinfo', userController.verifyToken, userController.getUser);

// Lấy tất cả user
router.get('/', userController.getAllUsers);

// Lấy user theo ID
router.get('/:id', userController.getUserById);

// Cập nhật user
router.put('/update/:id', userController.verifyToken, userController.updateUser);

// Xóa user
router.delete('/:id', userController.verifyToken, userController.deleteUser);

// Thay đổi mật khẩu
router.put('/change-password/:id', userController.verifyToken, userController.changePassword);

module.exports = router;