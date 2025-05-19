const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: function() { return !this.googleId; },
    trim: true,
    default: ''
  },
  phone: { 
    type: String, 
    required: function() { return !this.googleId; },
    match: [/^0\d{9}$/, 'Số điện thoại không hợp lệ'],
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ'],
  },
  password: { 
    type: String, 
    required: function() { return !this.googleId; },
    default: '',
    validate: {
      validator: function(value) {
        // Chỉ kiểm tra minlength nếu password bắt buộc và không rỗng
        if (this.googleId || value === '') return true;
        return value.length >= 8;
      },
      message: 'Mật khẩu phải có ít nhất 8 ký tự'
    }
  },
  address: { type: String, default: '', trim: true },
  listOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  birthday: { type: Date, default: null },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },
  emailVerificationToken: { type: String, default: null },
  passwordResetToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  googleId: { 
    type: String, 
    unique: true, 
    sparse: true, 
    validate: {
      validator: function(v) {
        return !v || typeof v === 'string' && v.length > 0;
      },
      message: 'Google ID không hợp lệ'
    }
  },
}, { versionKey: false });

// Tự động băm mật khẩu trước khi lưu (chỉ áp dụng nếu có password)
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password && this.password.length > 0) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('users', userSchema);