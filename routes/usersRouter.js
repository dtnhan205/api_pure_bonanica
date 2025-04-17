// routes/usersRouter.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../middleware/multerConfig');

// Route đăng ký người dùng
router.post('/register', userController.register);

// Route đăng nhập người dùng
router.post('/login', userController.login);

// Route lấy thông tin người dùng (yêu cầu token)
router.get('/me', userController.verifyToken, userController.getUser);

// Route cập nhật thông tin người dùng (yêu cầu token)
router.put('/update', userController.verifyToken, userController.updateUser);

// Route thay đổi mật khẩu (yêu cầu token)
router.put('/change-password', userController.verifyToken, userController.changePassword);

// Route upload avatar (yêu cầu token và file)
router.post('/upload-avatar', userController.verifyToken, upload.single('avatar'), userController.uploadAvatar);

// Route lấy tất cả người dùng (yêu cầu admin)
router.get('/', userController.verifyToken, userController.verifyAdmin, userController.getAllUsers);

// Route lấy danh sách người dùng hạn chế (không yêu cầu admin)
router.get('/list', userController.getUserList);

module.exports = router;