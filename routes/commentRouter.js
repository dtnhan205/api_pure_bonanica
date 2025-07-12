const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.post('/',authMiddleware, commentController.createComment);

router.get('/',authMiddleware,isAdmin, commentController.getAllCommentsForAdmin);

router.get('/product/:productId', commentController.getCommentsByProduct);

router.put('/:commentId',authMiddleware, commentController.updateComment);

router.put('/toggle-visibility/:commentId',authMiddleware,isAdmin, commentController.updateCommentStatus);

router.delete('/:commentId',authMiddleware, commentController.deleteComment);

module.exports = router; 