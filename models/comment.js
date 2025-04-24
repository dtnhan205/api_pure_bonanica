const mongoose = require('mongoose');


const commentSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users', // Tham chiếu đến model User
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Tham chiếu đến model Product (thay vì Order)
      required: true
    },
    content: {
      type: String, // Nội dung bình luận
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now // Thời gian tạo bình luận
    },
    updatedAt: {
      type: Date // Thời gian cập nhật bình luận
    }
  }, { versionKey: false });

module.exports = mongoose.model('Comment', commentSchema); 