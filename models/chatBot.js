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
        // Lưu base64 của hình ảnh để hiển thị khi load history
        imageBase64: {
          type: String,
          required: false,
        },
        // Lưu metadata hình ảnh (nếu cần)
        imageMetadata: {
          type: {
            mimeType: String,
            filename: String,
          },
          required: false,
        },
        // Lưu sản phẩm gợi ý
        products: [
          {
            name: { type: String, required: true },
            slug: { type: String, required: true },
            price: { type: Number, required: false },
            images: [{ type: String }],
          },
        ],
        // Lưu mã giảm giá gợi ý
        coupons: [
          {
            code: { type: String, required: true },
            discountValue: { type: Number, required: true },
            discountType: { type: String, required: true },
          },
        ],
        // Lưu tin tức gợi ý
        news: [
          {
            title: { type: String, required: true },
            slug: { type: String, required: true },
          },
        ],
        // Lưu thương hiệu gợi ý
        brands: [
          {
            name: { type: String, required: true },
          },
        ],
        // Lưu danh mục gợi ý
        categories: [
          {
            name: { type: String, required: true },
          },
        ],
      },
      { maxlength: 200 }, // Giới hạn số lượng tin nhắn
    ],
  },
  { versionKey: false, timestamps: true }
);

chatMessageSchema.index({ sessionId: 1 });
chatMessageSchema.index({ 'messages.timestamp': 1 });
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);