const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Khóa chính tùy chỉnh
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true }, // Tham chiếu đến id của Category
  description: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false }); // Tắt _id mặc định

module.exports = mongoose.model('SubCategory', subCategorySchema);