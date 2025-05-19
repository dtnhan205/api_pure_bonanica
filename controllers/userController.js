const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Đăng ký người dùng
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      status: 'pending',
      role: 'user',
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();

    const verificationUrl = `${process.env.BASE_URL}/api/users/verify-email/${verificationToken}`;
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Xác thực email của bạn',
      html: `<p>Vui lòng nhấp vào liên kết này để xác thực email: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });

    res.status(201).json({ message: 'Đăng ký thành công, vui lòng kiểm tra email để xác thực' });
  } catch (err) {
    console.error('Lỗi đăng ký:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đăng nhập người dùng
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản chưa được kích hoạt' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Đăng nhập thành công', token });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xác thực email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    user.status = 'active';
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: 'Xác thực email thành công' });
  } catch (err) {
    console.error('Lỗi xác thực email:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Quên mật khẩu
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 giờ
    await user.save();

    const resetUrl = `${process.env.BASE_URL}/api/users/reset-password/${resetToken}`;
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `<p>Vui lòng nhấp vào liên kết này để đặt lại mật khẩu: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    res.status(200).json({ message: 'Email đặt lại mật khẩu đã được gửi' });
  } catch (err) {
    console.error('Lỗi quên mật khẩu:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đặt lại mật khẩu
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    console.error('Lỗi đặt lại mật khẩu:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xác thực token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Lỗi xác thực token:', err.message, err.stack);
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error('Lỗi lấy thông tin người dùng:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (err) {
    console.error('Lỗi lấy danh sách người dùng:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error('Lỗi lấy người dùng theo ID:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Truy cập bị từ chối' });
    }

    const { username, email } = req.body;
    if (username) user.username = username;
    if (email) user.email = email;

    await user.save();
    res.status(200).json({ message: 'Cập nhật người dùng thành công', user });
  } catch (err) {
    console.error('Lỗi cập nhật người dùng:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Truy cập bị từ chối' });
    }

    await user.remove();
    res.status(200).json({ message: 'Xóa người dùng thành công' });
  } catch (err) {
    console.error('Lỗi xóa người dùng:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Truy cập bị từ chối' });
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Thay đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Lỗi thay đổi mật khẩu:', err.message, err.stack);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyToken,
  getUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
};