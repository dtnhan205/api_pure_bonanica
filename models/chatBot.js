const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'model'],
          required: true,
        },
        content: {
          type: String,
          required: true,
          maxlength: 5000,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        // Tùy chọn: Thêm trường imageMetadata nếu muốn lưu thông tin hình ảnh
        imageMetadata: {
          type: {
            mimeType: String,
            filename: String,
          },
          required: false,
        },
      },
      { maxlength: 200 }, // Giới hạn số lượng tin nhắn trong mỗi session
    ],
  },
  { versionKey: false, timestamps: true }
);

chatMessageSchema.index({ sessionId: 1 });
chatMessageSchema.index({ 'messages.timestamp': 1 });
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);