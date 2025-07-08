const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { googleAuth, googleAuthCallback } = require('../controllers/googleAuthController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


// Đăng ký
router.post('/register', userController.register);

// Login
router.post('/login', userController.login);

// Forgot password
router.post('/forgot-password', userController.forgotPassword);

// Reset password
router.post('/reset-password/:token', userController.resetPassword);

// Get user info (requires token)
router.get('/userinfo', authMiddleware, userController.getUser);

// Get all users
router.get('/',authMiddleware,isAdmin, userController.getAllUsers);

// Get user by ID
router.get('/:id',authMiddleware,isAdmin, userController.getUserById);

// Update user
router.put('/update/:id',authMiddleware, userController.verifyToken, userController.updateUser);

// Delete user
router.delete('/:id',authMiddleware,isAdmin, userController.verifyToken, userController.deleteUser);

// Change password
router.put('/change-password/:id', userController.verifyToken, userController.changePassword);

// Đăng nhập bằng Google
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback);

module.exports = router;