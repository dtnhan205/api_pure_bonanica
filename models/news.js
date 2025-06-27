const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  thumbnailUrl: { type: String, required: true, trim: true },
  thumbnailCaption: { type: String, default: '', trim: true },
  publishedAt: { type: Date, default: Date.now }, 
  views: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['hidden', 'show'], default: 'show' },
  createdAt: { type: Date, default: Date.now },
  content: { type: String, required: true, trim: true },
});

newsSchema.index({ views: -1 });

module.exports = mongoose.model('News', newsSchema);