const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getUser,
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  deleteUser
} = require('../controllers/userController');

router.post('/register', register);
router.post('/login', login);
router.get('/userinfo/:id', getUser);
router.put('/update/:id', updateUser);
router.put('/change-password/:id', changePassword);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.delete('/:id', deleteUser);

module.exports = router;
