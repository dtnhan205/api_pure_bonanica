var express = require('express');
var router = express.Router();

const {
  register,
  login,
  getUser,
  getAllUsers,
  verifyToken,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');

// Đăng ký và đăng nhập không cần xác thực token
router.post('/register', register);
router.post('/login', login);

// Các route cần xác thực token
router.get('/userinfo', verifyToken, getUser);
router.put('/update/:id', verifyToken, updateUser); 

// Các route không cần xác thực token
router.get('/', getAllUsers); 
router.get('/:id', getUserById);
router.delete('/:id', deleteUser);

module.exports = router;