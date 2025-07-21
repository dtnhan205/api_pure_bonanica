const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentCode: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'success', 'expired', 'failed'] },
  transactionId: { type: String },
  description: { type: String },
  transactionDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vnpay', paymentSchema);