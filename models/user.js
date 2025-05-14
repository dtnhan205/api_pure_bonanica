const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  phone: { type: String, required: true, match: [/^0\d{9}$/, 'Số điện thoại không hợp lệ'] },
  email: {
    type: String,
    required: true,
    unique: true,
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
  passwordResetToken: { type: String }, // Token để đặt lại mật khẩu
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { versionKey: false });

// Tự động băm mật khẩu trước khi lưu
const bcrypt = require('bcrypt');
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Index cho email
userSchema.index({ email: 1 });

module.exports = mongoose.model('users', userSchema);