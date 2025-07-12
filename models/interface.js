// models/interface.js
const mongoose = require('mongoose');

const InterfaceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['logo', 'favicon', 'banner1', 'banner2', 'decor', 'banner3', 'bannerAbout', 'bannerNews'],
    required: true
  },
  paths: {
    type: [String], // Mảng chứa đường dẫn hình ảnh
    required: true,
    default: [] // Giá trị mặc định là mảng rỗng
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware để tự động cập nhật updatedAt khi bản ghi thay đổi
InterfaceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Interface', InterfaceSchema);