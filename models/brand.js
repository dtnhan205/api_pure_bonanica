const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true, trim: true, unique: true },
  status: { type: String, enum: ['hidden', 'show'], default: 'show' }, 
});

module.exports = mongoose.model('Brand', brandSchema);