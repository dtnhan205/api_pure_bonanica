const userModel = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');



const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
const getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id, { password: 0 });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
const deleteUser = async (req, res) => {
  try {
    const user = await userModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Đăng ký
const register = async (req, res) => {
  try {
    const { username, phone, email, password } = req.body;
    const existingUser = await userModel.findOne({ email });
    if (existingUser) throw new Error('Email đã tồn tại');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({
      username,
      phone,
      email,
      password: hashedPassword
    });
    const savedUser = await user.save();

    const { password: _, ...userData } = savedUser._doc;
    res.status(201).json({ message: 'Đăng ký thành công', user: userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) throw new Error('Email không tồn tại');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error('Mật khẩu không đúng');

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      'conguoiyeuchua',
      { expiresIn: '1h' }
    );

    res.json({ token, message: 'Đăng nhập thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Middleware: xác thực token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Không có token' });

  jwt.verify(token, 'conguoiyeuchua', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token không hợp lệ hoặc hết hạn' });
    req.userId = decoded.id;
    next();
  });
};

// Lấy thông tin người dùng
const getUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId, { password: 0 });
    if (!user) throw new Error('Không tìm thấy người dùng');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật người dùng
const updateUser = async (req, res) => {
  try {
    const { username, phone, email, status, role } = req.body;
    const user = await userModel.findByIdAndUpdate(
      req.userId,
      { username, phone, email, status, role },
      { new: true, select: '-password' }
    );
    res.json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thay đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await userModel.findById(req.userId);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new Error('Mật khẩu cũ không đúng');

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getUser,
  verifyToken,
  updateUser,
  changePassword,
  getAllUsers,
  getUserById,
  deleteUser
};