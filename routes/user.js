var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');

const { 
  register, 
  login, 
  verifyToken, 
  getUser, 
  updateUser, 
  changePassword, 
  uploadAvatar 
} = require('../controllers/userController');

// Cấu hình multer để upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Đăng ký
router.post('/register', register);

// Đăng nhập
router.post('/login', login);

// Lấy thông tin 1 user theo token
router.get('/userinfo', verifyToken, getUser);

// Cập nhật thông tin người dùng
router.put('/update', verifyToken, updateUser);

// Thay đổi mật khẩu
router.put('/change-password', verifyToken, changePassword);

// Upload avatar
router.post('/upload-avatar', verifyToken, upload.single('avatar'), uploadAvatar);

module.exports = router;