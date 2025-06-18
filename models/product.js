const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
  status: { type: String, enum: ['hidden', 'show'], default: 'show' },
  view: { type: Number, default: 0 },
  id_brand: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Brand' },
  id_category: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Category' },
  images: [{ type: String }],
  short_description: [{ type: String }],
  description: [{ type: String }],
  usage_instructions: [{ type: String }],
  ingredients: [
    {
      name_ingredients: { type: String, trim: true },
      uses_ingredients: { type: String, trim: true }
    }
  ],
  warning: [{ type: String }],
  product_uses: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);