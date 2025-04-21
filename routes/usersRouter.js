const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  deleteUser,
  register,
  login,
  getUser,
  verifyToken,
  updateUser,
  changePassword
} = require('../controllers/userController');

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.delete('/:id', deleteUser);
router.post('/register', register);
router.post('/login', login);
router.get('/userinfo', verifyToken, getUser);
router.put('/update', verifyToken, updateUser,changePassword);

module.exports = router;
