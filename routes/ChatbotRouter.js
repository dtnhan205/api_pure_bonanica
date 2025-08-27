const express = require('express');
const router = express.Router();
const chatController = require('../controllers/ChatBotController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/session', chatController.createOrGetSession);
router.post('/send', chatController.sendMessage);
router.get('/history/:sessionId', chatController.getChatHistory);
router.delete('/session/:sessionId', authMiddleware, isAdmin, chatController.deleteSession);
router.post('/analyze-skin', chatController.analyzeSkin); 

module.exports = router;