const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  images: [{ type: String, trim: true }],
  category: { type: mongoose.Schema, ref: 'Category', required: true },
  stock: { type: Number, required: true, min: 0 },
  ingredients: [{ type: String, trim: true }], 
  usage_instructions: [{ type: String, trim: true }], 
  special: [{ type: String, trim: true }], 
  created_at: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Product', productSchema);