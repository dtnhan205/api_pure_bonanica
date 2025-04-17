const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  phone: { type: String, required: true }, 
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: 'active' }, 
  createdAt: { type: Date, default: Date.now }, 
  role: { type: String, default: 'user' } 
}, { versionKey: false });

module.exports = mongoose.model('users', userSchema);
