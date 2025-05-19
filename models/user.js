const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: function() { return !this.googleId; }, // Bắt buộc nếu không có googleId
    trim: true,
    default: '' // Giá trị mặc định rỗng cho trường hợp Google Auth
  },
  phone: { 
    type: String, 
    required: function() { return !this.googleId; }, // Bắt buộc nếu không có googleId
    match: [/^0\d{9}$/, 'Số điện thoại không hợp lệ'],
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ']
  },
  password: { 
    type: String, 
    required: function() { return !this.googleId; }, // Bắt buộc nếu không có googleId
    minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'],
    default: null // Đổi default thành null để tránh lỗi validation
  },
  address: { type: String, default: '', trim: true },
  listOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  birthday: { type: Date, default: null },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active'
  },
  emailVerificationToken: { type: String, default: null },
  passwordResetToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  googleId: { 
    type: String, 
    unique: true, 
    sparse: true, // Cho phép nhiều document không có googleId
    validate: {
      validator: function(v) {
        return !v || (typeof v === 'string' && v.length > 0);
      },
      message: 'Google ID không hợp lệ'
    }
  }
}, { versionKey: false });

// Middleware: Băm mật khẩu trước khi lưu, chỉ áp dụng nếu password hợp lệ
userSchema.pre('save', async function(next) {
  // Chỉ băm nếu password được sửa đổi và không rỗng
  if (this.isModified('password') && this.password && this.password.length >= 8) {
    try {
      this.password = await bcrypt.hash(this.password, 10);
    } catch (error) {
      return next(error);
    }
  }
  // Nếu password rỗng và có googleId, đặt thành null để tránh validation lỗi
  if (this.googleId && (!this.password || this.password === '')) {
    this.password = null;
  }
  next();
});


module.exports = mongoose.model('users', userSchema);