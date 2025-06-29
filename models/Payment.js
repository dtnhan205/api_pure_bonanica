const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentCode: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, 
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  transactionId: { type: String },
  status: { type: String, enum: ['pending', 'success', 'expired'], default: 'pending' },
  description: { type: String },
  transactionDate: { type: Date },
});

module.exports = mongoose.model('Payment', paymentSchema);