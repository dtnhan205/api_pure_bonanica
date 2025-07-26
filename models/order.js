const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product.option', // Tham chiếu đến _id của option trong Product
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  images: [String] // Giữ lại nếu cần lưu ảnh
});

const orderSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },
  address: {
    addressLine: { type: String, required: true },
    ward: { type: String, required: true },
    district: { type: String, required: true },
    cityOrProvince: { type: String, required: true }
  },
  sdt: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'bank', 'vnpay', 'momo'],
    required: true
  },
  note: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    required: true
  },
  shippingStatus: { 
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'returned'],
    default: 'pending',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { versionKey: false });

module.exports = mongoose.model('Order', orderSchema);