const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, unique: true }, 
  status: { type: String, enum: ['hidden', 'show'], default: 'show' },
  active: { type: Boolean, default: true },
  view: { type: Number, default: 0 },
  id_brand: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Brand' },
  id_category: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Category' },
  images: [{ type: String }],
  short_description: { type: String },
  description: { type: String },
  option: [
    {
      stock: { type: Number, required: true, min: 0 },
      value: { type: String, trim: true, required: true },
      price: { type: Number, required: true, min: 0 },
      discount_price: { type: Number, default: 0, min: 0 }
    }
  ],
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Trường virtual `isActive` để kiểm tra trạng thái thực tế
productSchema.virtual('isActive').get(function() {
  // Giả định rằng id_category đã được populate với trường status
  if (!this.id_category || this.id_category.status === 'hidden') {
    return false;
  }
  return this.active;
});

// Đảm bảo trường virtual được bao gồm trong JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);