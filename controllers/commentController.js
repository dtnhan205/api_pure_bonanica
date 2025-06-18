const Comment = require('../models/comment');
const Product = require('../models/product');
const User = require('../models/user');

// Tạo bình luận mới cho sản phẩm
exports.createComment = async (req, res) => {
  try {
    const { userId, productId, content } = req.body;

    if (!userId || !productId || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId, productId hoặc content' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    const comment = new Comment({
      user: userId,
      product: productId,
      content,
      status: 'show' // Mặc định trạng thái là show khi tạo mới
    });

    await comment.save();

    // Populate thông tin user và product
    await comment.populate([
      { path: 'user', select: 'username email' },
      { path: 'product', select: 'name price images' }
    ]);

    res.status(201).json({ message: 'Tạo bình luận thành công', comment });
  } catch (error) {
    console.error('Lỗi khi tạo bình luận:', error.stack);
    res.status(500).json({ error: 'Lỗi khi tạo bình luận', details: error.message });
  }
};

// Lấy tất cả bình luận (dành cho admin)
exports.getAllCommentsForAdmin = async (req, res) => {
  try {
    // Kiểm tra quyền admin (giả sử có middleware kiểm tra quyền)
    const userId = req.user?.id; // Lấy userId từ token hoặc session
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền xem tất cả bình luận' });
    }

    const comments = await Comment.find()
      .populate('user', 'username email')
      .populate('product', 'name price images')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error('Lỗi khi lấy tất cả bình luận (admin):', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy tất cả bình luận (admin)', details: error.message });
  }
};

// Lấy tất cả bình luận liên quan đến một sản phẩm
exports.getCommentsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: 'Thiếu productId trong yêu cầu' });
    }

    // Chỉ lấy các bình luận có status: show cho người dùng thông thường
    const comments = await Comment.find({ product: productId, status: 'show' })
      .populate('user', 'username email')
      .populate('product', 'name price images')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error('Lỗi khi lấy bình luận theo sản phẩm:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy bình luận theo sản phẩm', details: error.message });
  }
};

// Cập nhật bình luận
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, content } = req.body;

    if (!userId || !commentId || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId, commentId hoặc content' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Bình luận không tồn tại' });
    }

    if (comment.user.toString() !== userId && !user.isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bình luận này' });
    }

    comment.content = content;
    comment.updatedAt = new Date();
    await comment.save();

    // Populate thông tin user và product
    await comment.populate([
      { path: 'user', select: 'username email' },
      { path: 'product', select: 'name price images' }
    ]);

    res.json({ message: 'Cập nhật bình luận thành công', comment });
  } catch (error) {
    console.error('Lỗi khi cập nhật bình luận:', error.stack);
    res.status(500).json({ error: 'Lỗi khi cập nhật bình luận', details: error.message });
  }
};

// Cập nhật trạng thái bình luận (show/hidden) - chỉ dành cho admin
exports.updateCommentStatus = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, status } = req.body;

    if (!userId || !commentId || !status) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId, commentId hoặc status' });
    }

    if (!['show', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ, chỉ được phép là "show" hoặc "hidden"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi trạng thái bình luận' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Bình luận không tồn tại' });
    }

    comment.status = status;
    comment.updatedAt = new Date();
    await comment.save();

    // Populate thông tin user và product
    await comment.populate([
      { path: 'user', select: 'username email' },
      { path: 'product', select: 'name price images' }
    ]);

    res.json({ message: `Cập nhật trạng thái bình luận thành ${status}`, comment });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái bình luận:', error.stack);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái bình luận', details: error.message });
  }
};

// Xóa bình luận
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId || !commentId) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId hoặc commentId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Bình luận không tồn tại' });
    }

    if (comment.user.toString() !== userId && !user.isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này' });
    }

    await comment.deleteOne();
    res.json({ message: 'Xóa bình luận thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bình luận:', error.stack);
    res.status(500).json({ error: 'Lỗi khi xóa bình luận', details: error.message });
  }
};