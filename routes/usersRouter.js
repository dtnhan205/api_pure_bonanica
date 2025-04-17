const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getUser,
  verifyToken,
  updateUser,
  changePassword
} = require('../controllers/userController');

router.post('/register', register);
router.post('/login', login);
router.get('/userinfo', verifyToken, getUser);
router.put('/update', verifyToken, updateUser);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;
