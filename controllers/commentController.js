const multer = require('multer');
const Comment = require("../models/comment");
const Product = require("../models/product");
const User = require("../models/user");
const Order = require("../models/order");

// Tạo bình luận mới cho sản phẩm
exports.createComment = async (req, res) => {
  try {
    const { userId, productId, content, rating } = req.body;

    if (!userId || !productId || !content || !rating) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: userId, productId, content hoặc rating",
      });
    }

    if (isNaN(rating) || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      return res.status(400).json({ error: "Đánh giá sao phải là số nguyên từ 1 đến 5" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });
    }

    const existingComment = await Comment.findOne({ user: userId, product: productId });
    if (existingComment) {
      return res.status(403).json({ error: "Bạn đã bình luận cho sản phẩm này rồi." });
    }

    const order = await Order.findOne({
      user: userId,
      "items.product": productId,
      paymentStatus: "completed",
      shippingStatus: "delivered",
    }).lean();

    if (!order) {
      return res.status(403).json({
        error: "Bạn chỉ có thể đánh giá sản phẩm sau khi mua, thanh toán và nhận hàng thành công",
      });
    }

    // Tạo mảng images và videos với định dạng { url, public_id }
    const images = (req.files && req.files["images"])
      ? req.files["images"].map((file) => ({
          url: file.path,
          public_id: file.filename
        }))
      : [];
    const videos = (req.files && req.files["commentVideo"])
      ? req.files["commentVideo"].map((file) => ({
          url: file.path,
          public_id: file.filename
        }))
      : [];

    const comment = new Comment({
      user: userId,
      product: productId,
      content: content.trim().substring(0, 500),
      rating: Number(rating),
      status: "show",
      images,
      videos,
    });

    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "adminReply.user", select: "username email role" },
    ]);

    res.status(201).json({ message: "Tạo bình luận thành công", comment });
  } catch (error) {
    console.error("Lỗi khi tạo bình luận:", error.message);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Lỗi tải tệp: ${error.message}` });
    }
    res.status(500).json({ error: "Lỗi khi tạo bình luận", details: error.message });
  }
};

// Cập nhật bình luận
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, content, rating } = req.body;

    if (!userId || !commentId || !content || rating === undefined) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: userId, commentId, content hoặc rating",
      });
    }

    if (isNaN(rating) || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      return res.status(400).json({ error: "Đánh giá sao phải là số nguyên từ 1 đến 5" });
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
      return res.status(403).json({ error: "Bạn không có quyền chỉnh sửa bình luận này" });
    }

    // Cập nhật images và videos với định dạng { url, public_id }
    const images = (req.files && req.files["images"] && req.files["images"].length > 0)
      ? req.files["images"].map((file) => ({
          url: file.path,
          public_id: file.filename
        }))
      : comment.images;
    const videos = (req.files && req.files["commentVideo"] && req.files["commentVideo"].length > 0)
      ? req.files["commentVideo"].map((file) => ({
          url: file.path,
          public_id: file.filename
        }))
      : comment.videos;

    comment.content = content.trim().substring(0, 500);
    comment.rating = Number(rating);
    comment.images = images;
    comment.videos = videos;
    comment.updatedAt = new Date();
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "adminReply.user", select: "username email role" },
    ]);

    res.json({ message: "Cập nhật bình luận thành công", comment });
  } catch (error) {
    console.error("Lỗi khi cập nhật bình luận:", error.message);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Lỗi tải tệp: ${error.message}` });
    }
    res.status(500).json({ error: "Lỗi khi cập nhật bình luận", details: error.message });
  }
};

// Các hàm khác giữ nguyên
exports.getAllCommentsForAdmin = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate([
        { path: "user", select: "username email role" },
        { path: "product", select: "name price images" },
        { path: "adminReply.user", select: "username email role" },
      ])
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Lỗi khi lấy tất cả bình luận (admin):", error.message);
    res.status(500).json({ error: "Lỗi khi lấy tất cả bình luận (admin)", details: error.message });
  }
};

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
        { path: "adminReply.user", select: "username email role" },
      ])
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Lỗi khi lấy bình luận theo sản phẩm:", error.message);
    res.status(500).json({
      error: "Lỗi khi lấy bình luận theo sản phẩm",
      details: error.message,
    });
  }
};

exports.updateCommentStatus = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user || !commentId || !status) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: user, commentId hoặc status" });
    }

    const normalizedStatus = status.trim().toLowerCase();
    if (!["show", "hidden"].includes(normalizedStatus)) {
      return res.status(400).json({
        error: 'Trạng thái không hợp lệ, chỉ được phép là "show" hoặc "hidden"',
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền thay đổi trạng thái bình luận" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    comment.status = normalizedStatus;
    comment.updatedAt = new Date();
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "adminReply.user", select: "username email role" },
    ]);

    res.json({
      message: `Cập nhật trạng thái bình luận thành ${normalizedStatus}`,
      comment,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái bình luận:", error.message);
    res.status(500).json({ error: "Lỗi khi cập nhật trạng thái bình luận", details: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId || !commentId) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: userId hoặc commentId" });
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
      return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này" });
    }

    await comment.deleteOne();
    res.json({ message: "Xóa bình luận thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bình luận:", error.message);
    res.status(500).json({ error: "Lỗi khi xóa bình luận", details: error.message });
  }
};

exports.addAdminReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const user = req.user;

    if (!user || !commentId || !content) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: user, commentId hoặc content" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền gửi phản hồi" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    if (comment.adminReply && comment.adminReply.content) {
      return res.status(403).json({ error: "Bình luận này đã có phản hồi từ admin" });
    }

    comment.adminReply = {
      user: user.id,
      content: content.trim().substring(0, 500),
      createdAt: new Date(),
    };
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "adminReply.user", select: "username email role" },
    ]);

    res.json({ message: "Phản hồi từ admin đã được gửi", comment });
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi từ admin:", error.message);
    res.status(500).json({ error: "Lỗi khi gửi phản hồi từ admin", details: error.message });
  }
};
exports.updateAdminReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const user = req.user;

    if (!user || !commentId || !content) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: user, commentId hoặc content" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền chỉnh sửa phản hồi" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại" });
    }

    if (!comment.adminReply || !comment.adminReply.content) {
      return res.status(404).json({ error: "Bình luận này chưa có phản hồi từ admin để chỉnh sửa" });
    }

    comment.adminReply.content = content.trim().substring(0, 500);
    comment.adminReply.updatedAt = new Date();
    await comment.save();

    await comment.populate([
      { path: "user", select: "username email role" },
      { path: "product", select: "name price images" },
      { path: "adminReply.user", select: "username email role" },
    ]);

    res.json({ message: "Cập nhật phản hồi admin thành công", comment });
  } catch (error) {
    console.error("Lỗi khi cập nhật phản hồi admin:", error.message);
    res.status(500).json({ error: "Lỗi khi cập nhật phản hồi admin", details: error.message });
  }
};