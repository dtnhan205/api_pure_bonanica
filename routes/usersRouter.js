const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Register
router.post('/register', userController.register);

// Login
router.post('/login', userController.login);

// Forgot password
router.post('/forgot-password', userController.forgotPassword);

// Reset password
router.post('/reset-password/:token', userController.resetPassword);

// Get user info (requires token)
router.get('/userinfo', userController.verifyToken, userController.getUser);

// Get all users
router.get('/', userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user
router.put('/update/:id', userController.verifyToken, userController.updateUser);

// Delete user
router.delete('/:id', userController.verifyToken, userController.deleteUser);

// Change password
router.put('/change-password/:id', userController.verifyToken, userController.changePassword);

module.exports = router;