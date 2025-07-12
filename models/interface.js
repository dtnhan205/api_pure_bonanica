const mongoose = require('mongoose');

const InterfaceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['logo', 'favicon', 'banner1', 'banner2', 'decor', 'banner3', 'bannerAbout', 'bannerNews'],
    required: true
  },
  path: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Interface', InterfaceSchema);