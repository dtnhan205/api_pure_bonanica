const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product.option',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  images: [String]
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
    enum: ['pending', 'confirmed', 'in_transit', 'delivered', 'returned', 'cancelled', 'failed'],
    default: 'pending',
    required: true
  },
  returnStatus: {
    type: String,
    enum: ['none', 'requested', 'approved', 'rejected'],
    default: 'none',
    required: true
  },
  returnRequestDate: {
    type: Date,
    default: null
  },
  returnReason: {
    type: String,
    default: null
  },
  returnImages: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  }],
  returnVideos: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  }],
  cancelReason: {
    type: String,
    enum: [
      'Đổi ý không mua nữa',
      'Muốn thay đổi sản phẩm',
      'Thay đổi phương thức thanh toán',
      'Thay đổi địa chỉ giao hàng',
      'Lý do khác',
      'out_of_stock',
      'customer_cancelled',
      'system_error',
      'other',
      null
    ],
    default: null
  },
  cancelNote: {
    type: String,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null
  },
  failReason: {
    type: String,
    default: null
  },
  confirmedAt: { // Thêm trường để lưu thời gian xác nhận
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  versionKey: false,
  timestamps: true 
});

// Add index for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, shippingStatus: 1 });

// Add virtual for cancellation status
orderSchema.virtual('isCancelled').get(function() {
  return this.shippingStatus === 'cancelled' && this.paymentStatus === 'cancelled';
});

// Add virtual for failed status
orderSchema.virtual('isFailed').get(function() {
  return this.shippingStatus === 'failed' && this.paymentStatus === 'failed';
});

// Add virtual for confirmed status
orderSchema.virtual('isConfirmed').get(function() {
  return this.shippingStatus === 'confirmed';
});

// Add method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed'].includes(this.shippingStatus) && this.paymentStatus === 'pending';
};

// Add method to check if order can be marked as failed
orderSchema.methods.canBeMarkedAsFailed = function() {
  return ['confirmed', 'in_transit'].includes(this.shippingStatus);
};

module.exports = mongoose.model('Order', orderSchema);