const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Khóa chính tùy chỉnh
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false }); // Tắt _id mặc định

module.exports = mongoose.model('Category', categorySchema);