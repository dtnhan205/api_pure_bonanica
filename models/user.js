const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Tên người dùng phải có ít nhất 3 ký tự'],
    match: [/^[a-zA-Z0-9\s]+$/, 'Tên người dùng chỉ được chứa chữ cái, số và khoảng trắng'],
  },
  phone: {
    type: String,
    required: true,
    match: [/^0\d{9}$/, 'Số điện thoại không hợp lệ'],
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
    required: true,
    minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'],
  },
  address: {
    type: {
      addressLine: { type: String, trim: true, default: '' },
      ward: { type: String, trim: true, default: '' },
      district: { type: String, trim: true, default: '' },
      cityOrProvince: { type: String, trim: true, default: '' },
    },
    default: {
      addressLine: '',
      ward: '',
      district: '',
      cityOrProvince: '',
    },
  },
  listOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  birthday: {
    type: Date,
    validate: {
      validator: function (value) {
        return !value || value <= new Date();
      },
      message: 'Ngày sinh không được trong tương lai',
    },
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },
  passwordResetToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
}, { versionKey: false });

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ username: 1 });

// Automatically hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    console.log(`Hashing password for user: ${this.email}`);
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('users', userSchema);