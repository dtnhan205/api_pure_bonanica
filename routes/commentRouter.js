const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.post('/', commentController.createComment);

router.get('/', commentController.getAllCommentsForAdmin);

router.get('/product/:productId', commentController.getCommentsByProduct);

router.put('/:commentId', commentController.updateComment);

router.put('/toggle-visibility/:commentId', commentController.updateCommentStatus);

router.delete('/:commentId', commentController.deleteComment);

module.exports = router; 