const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  phone: { type: String, required: true, match: [/^0\d{9}$/, 'Số điện thoại không hợp lệ'] },
  email: {
    type: String,
    required: true,
    unique: true, // This creates a unique index automatically
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ'],
  },
  password: { type: String, required: true, minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'] },
  address: { type: String, default: '', trim: true },
  listOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  birthday: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'banned'],
    default: 'pending',
  },
  emailVerificationToken: { type: String },
  passwordResetToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { versionKey: false });

// Tự động băm mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('users', userSchema);