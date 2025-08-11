const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", // Tham chiếu đến user đã reply
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  parentReplyIndex: { // Thêm trường này để chỉ reply con (optional, chỉ cho user reply)
    type: Number,
    default: null,
  },
});

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["show", "hidden"],
      default: "show",
    },
    replies: [replySchema], // Mảng replies với hỗ trợ parent
  },
  { versionKey: false }
);

module.exports = mongoose.model("Comment", commentSchema);