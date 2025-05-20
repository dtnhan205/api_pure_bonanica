const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, 
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  images: [{ type: String, trim: true }],
  discountPrice: { type: Number, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String, trim: true },
  color: { type: String, trim: true },
  brand: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  ingredients: [{ type: String, trim: true }],
  usage_instructions: [{ type: String, trim: true }],
  special: [{ type: String, trim: true }],
  stock: { type: Number, required: true, min: 0 },
  view: { type: Number, default: 0 },
  status: { type: String, enum: ['hidden', 'show'], default: 'show' },
});

module.exports = mongoose.model('Product', productSchema);