const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  image: { type: String, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  stock_quantity: { type: Number, required: true, min: 0 },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);