const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  option: { // Sử dụng option nhúng thay vì optionId
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    stock: { type: Number, required: true, min: 0 },
    value: { type: String, trim: true, required: true },
    price: { type: Number, required: true, min: 0 },
    discount_price: { type: Number, default: 0, min: 0 }
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);