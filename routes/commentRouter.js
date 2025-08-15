const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');
const { upload, handleMulterError } = require('../middlewares/upload');

// Use upload.fields to handle multiple fields (images and commentVideo)
router.post('/', authMiddleware, upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'commentVideo', maxCount: 5 }
]), handleMulterError, commentController.createComment);

router.get('/', authMiddleware, isAdmin, commentController.getAllCommentsForAdmin);

router.post(
  "/:commentId/reply",
  authMiddleware,
  isAdmin,
  commentController.addAdminReply
);

router.get('/product/:productId', commentController.getCommentsByProduct); // Public access

router.put('/:commentId', authMiddleware, upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'commentVideo', maxCount: 5 }
]), handleMulterError, commentController.updateComment);

router.put('/toggle-visibility/:commentId', authMiddleware, isAdmin, commentController.updateCommentStatus);

router.delete('/:commentId', authMiddleware, commentController.deleteComment);

module.exports = router;