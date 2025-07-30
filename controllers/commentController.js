const Comment = require('../models/comment');
const Product = require('../models/product');
const User = require('../models/user');

// Tạo bình luận mới cho sản phẩm
exports.createComment = async (req, res) => {
  try {
    const { userId, productId, content, rating } = req.body;

    if (!userId || !productId || !content || !rating) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId, productId, content hoặc rating' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Đánh giá sao phải nằm trong khoảng từ 1 đến 5' });
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
      rating,
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
    const { userId, content, rating } = req.body;

    if (!userId || !commentId || !content || rating === undefined) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: userId, commentId, content hoặc rating' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Đánh giá sao phải nằm trong khoảng từ 1 đến 5' });
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
    comment.rating = rating;
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
    const { status } = req.body;
    const user = req.user; // Lấy thông tin người dùng từ authMiddleware

    // Kiểm tra các trường bắt buộc
    if (!user || !commentId || !status) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: user, commentId hoặc status' });
    }

    // Chuẩn hóa trạng thái
    const normalizedStatus = status.trim().toLowerCase();
    if (!['show', 'hidden'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ, chỉ được phép là "show" hoặc "hidden"' });
    }

    // Kiểm tra quyền admin dựa trên role
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi trạng thái bình luận' });
    }

    // Tìm bình luận
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Bình luận không tồn tại' });
    }

    // Cập nhật trạng thái
    comment.status = normalizedStatus;
    comment.updatedAt = new Date();
    await comment.save();

    // Populate thông tin user và product
    try {
      await comment.populate([
        { path: 'user', select: 'username email' },
        { path: 'product', select: 'name price images' }
      ]);
    } catch (populateError) {
      console.warn('Cảnh báo: Lỗi khi populate dữ liệu:', populateError.message);
    }

    res.json({ message: `Cập nhật trạng thái bình luận thành ${normalizedStatus}`, comment });
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