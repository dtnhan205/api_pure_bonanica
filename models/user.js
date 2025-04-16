const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
},{versionKey: false});
const userModel = mongoose.model('users', userSchema);

module.exports = userModel;