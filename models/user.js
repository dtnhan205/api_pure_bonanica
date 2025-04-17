// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  sdt: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  trangThai: {
    type: String,
    default: 'online',
  },
  ngayTao: {
    type: Date,
    default: Date.now,
  },
  quyenHan: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  avatar: {
    type: String,
    default: null,
  },
  trangThaiKhan: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model('User', userSchema);