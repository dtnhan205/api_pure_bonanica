const mongoose = require('mongoose');

const productAttributeSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  id_product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  id_attribute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attribute',
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  Price: {
    type: Number,
    required: true,
  },
  SalePrice: {
    type: Number,
    required: true,
  },
  Stock: {
    type: Number,
    required: true,
  }
});

module.exports = mongoose.models.ProductAttribute || mongoose.model('ProductAttribute', productAttributeSchema);