const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');
const { commentUpload, handleMulterError } = require('../middlewares/upload');

router.post('/', authMiddleware, (req, res, next) => {
  console.log("Middleware commentUpload is being executed");
  next();
}, commentUpload, handleMulterError, commentController.createComment);

router.get('/', authMiddleware, isAdmin, commentController.getAllCommentsForAdmin);

router.post('/:commentId/reply', authMiddleware, isAdmin, commentController.addAdminReply);

router.get('/product/:productId', commentController.getCommentsByProduct);

router.put('/:commentId', authMiddleware, (req, res, next) => {
  console.log("Middleware commentUpload is being executed for PUT");
  next();
}, commentUpload, handleMulterError, commentController.updateComment);

router.put('/toggle-visibility/:commentId', authMiddleware, isAdmin, commentController.updateCommentStatus);

router.delete('/:commentId', authMiddleware, commentController.deleteComment);

module.exports = router;