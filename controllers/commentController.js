const Comment = require("../models/comment");
const Product = require("../models/product");
const User = require("../models/user");
const Order = require("../models/order");

// Tạo bình luận mới cho sản phẩm
exports.createComment = async (req, res) => {
  try {
    const { userId, productId, content, rating } = req.body;

    if (!userId || !productId || !content || !rating) {
      return res
        .status(400)
        .json({
          error: "Thiếu thông tin bắt buộc: userId, productId, content hoặc rating",
        });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Đánh giá sao phải nằm trong khoảng từ 1 đến 5" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra xem người dùng đã mua sản phẩm và đơn hàng đã thanh toán
    const order = await Order.findOne({
      user: userId,
      "items.product": productId,
      paymentStatus: "paid",
    });

    if (!order) {
      return res
        .status(403)
        .json({ error: "Bạn chỉ có thể đánh giá sản phẩm sau khi mua và thanh toán thành công" });
    }

    const comment = new Comment({
      user: userId,
      product: productId,
      content,
      rating,
      status: "show",
    });

    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "replies.user", select: "username email role" },
    ]);

    res.status(201).json({ message: "Tạo bình luận thành công", comment });
  } catch (error) {
    console.error("Lỗi khi tạo bình luận:", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi tạo bình luận", details: error.message });
  }
};

// Lấy tất cả bình luận (dành cho admin)
exports.getAllCommentsForAdmin = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate([
        { path: "user", select: "username email role" },
        { path: "product", select: "name price images" },
        { path: "replies.user", select: "username email role" },
      ])
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Lỗi khi lấy tất cả bình luận (admin):", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy tất cả bình luận (admin)", details: error.message });
  }
};

// Lấy tất cả bình luận liên quan đến một sản phẩm
exports.getCommentsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "Thiếu productId trong yêu cầu" });
    }

    const comments = await Comment.find({ product: productId, status: "show" })
      .populate([
        { path: "user", select: "username email role" },
        { path: "product", select: "name price images" },
        { path: "replies.user", select: "username email role" },
      ])
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Lỗi khi lấy bình luận theo sản phẩm:", error.stack);
    res
      .status(500)
      .json({
        error: "Lỗi khi lấy bình luận theo sản phẩm",
        details: error.message,
      });
  }
};

// Cập nhật bình luận
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, content, rating } = req.body;

    if (!userId || !commentId || !content || rating === undefined) {
      return res
        .status(400)
        .json({
          error: "Thiếu thông tin bắt buộc: userId, commentId, content hoặc rating",
        });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Đánh giá sao phải nằm trong khoảng từ 1 đến 5" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    if (comment.user.toString() !== userId && !user.isAdmin) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền chỉnh sửa bình luận này" });
    }

    comment.content = content;
    comment.rating = rating;
    comment.updatedAt = new Date();
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "replies.user", select: "username email role" },
    ]);

    res.json({ message: "Cập nhật bình luận thành công", comment });
  } catch (error) {
    console.error("Lỗi khi cập nhật bình luận:", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi cập nhật bình luận", details: error.message });
  }
};

// Cập nhật trạng thái bình luận (show/hidden) - chỉ dành cho admin
exports.updateCommentStatus = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user || !commentId || !status) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin bắt buộc: user, commentId hoặc status" });
    }

    const normalizedStatus = status.trim().toLowerCase();
    if (!["show", "hidden"].includes(normalizedStatus)) {
      return res
        .status(400)
        .json({
          error: 'Trạng thái không hợp lệ, chỉ được phép là "show" hoặc "hidden"',
        });
    }

    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền thay đổi trạng thái bình luận" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    comment.status = normalizedStatus;
    comment.updatedAt = new Date();
    await comment.save();

    try {
      await comment.populate([
        { path: "user", select: "username email role" },
        { path: "product", select: "name price images" },
        { path: "replies.user", select: "username email role" },
      ]);
    } catch (populateError) {
      console.warn("Cảnh báo: Lỗi khi populate dữ liệu:", populateError.message);
    }

    res.json({
      message: `Cập nhật trạng thái bình luận thành ${normalizedStatus}`,
      comment,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái bình luận:", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi cập nhật trạng thái bình luận", details: error.message });
  }
};

// Xóa bình luận
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId || !commentId) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin bắt buộc: userId hoặc commentId" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    if (comment.user.toString() !== userId && !user.isAdmin) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền xóa bình luận này" });
    }

    await comment.deleteOne();
    res.json({ message: "Xóa bình luận thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bình luận:", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi xóa bình luận", details: error.message });
  }
};

// Thêm phản hồi từ admin
exports.replyToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const user = req.user;

    if (!user || !commentId || !content) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin bắt buộc: user, commentId hoặc content" });
    }

    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền gửi phản hồi" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    comment.replies.push({
      user: user.id,
      content,
    });
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "replies.user", select: "username email role" },
    ]);

    res.json({ message: "Phản hồi đã được gửi", comment });
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi:", error.stack);
    res
      .status(500)
      .json({ error: "Lỗi khi gửi phản hồi", details: error.message });
  }
};

// Thêm phản hồi từ user (phản hồi lại admin)
exports.replyToReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, replyIndex } = req.body;
    const user = req.user;

    if (!user || !commentId || !content || replyIndex === undefined) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: user, commentId, content hoặc replyIndex",
      });
    }

    const comment = await Comment.findById(commentId).populate("replies.user", "username email role");
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    if (comment.user.toString() !== user.id) {
      return res.status(403).json({ error: "Chỉ người tạo bình luận gốc được phép trả lời" });
    }

    if (
      !comment.replies ||
      replyIndex < 0 ||
      replyIndex >= comment.replies.length ||
      comment.replies[replyIndex].user.role !== "admin"
    ) {
      return res.status(400).json({
        error: "Phản hồi gốc không hợp lệ hoặc không phải từ admin",
      });
    }

    comment.replies.push({
      user: user.id,
      content: content.trim(),
      parentReplyIndex: replyIndex,
    });
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "replies.user", select: "username email role" },
    ]);

    res.json({ message: "Phản hồi từ user đã được gửi", comment });
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi từ user:", error.stack);
    res.status(500).json({ error: "Lỗi khi gửi phản hồi từ user", details: error.message });
  }
};