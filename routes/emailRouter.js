const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.post('/sendEmail',authMiddleware, emailController.sendEmail);

module.exports = router;