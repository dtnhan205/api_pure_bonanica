const userModel = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

// Đăng ký người dùng
const register = async (req, res) => {
  try {
    const { username, phone, email, password, address, birthday, listOrder, status } = req.body;

    // Validate input
    if (!username || !phone || !email || !password) {
      return res.status(400).json({ message: 'Tất cả các trường username, phone, email, password đều bắt buộc' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }
    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({ message: 'Số điện thoại phải từ 10 đến 15 chữ số' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }

    // Kiểm tra email tồn tại
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    // Tạo token xác thực email
    const emailVerificationToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '24h' }
    );

    // Tạo user
    const user = new userModel({
      username,
      phone,
      email,
      password,
      address: address || '',
      birthday: birthday ? new Date(birthday) : null,
      listOrder: Array.isArray(listOrder) ? listOrder : [],
      status: 'pending',
      emailVerificationToken,
    });
    const savedUser = await user.save();

    // Gửi email xác thực
    try {
      const verificationUrl = `http://localhost:10000/api/users/verify-email/${emailVerificationToken}`;
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username,
        email,
        subject: 'Xác thực email của bạn 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Xác thực email của bạn</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;"> 
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Cảm ơn bạn đã đăng ký tại Pure-Botanica! Vui lòng nhấp vào nút dưới đây để xác thực email của bạn:
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Xác thực ngay!</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 0;">
                Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này. Link này sẽ hết hạn sau 24 giờ.
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(`Lỗi gửi email cho ${email}:`, emailError.message);
    }

    // Loại bỏ password và token
    const { password: _, emailVerificationToken: __, ...userData } = savedUser._doc;
    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.', user: userData });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Xác thực email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
    } catch (err) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await userModel.findOne({ email: decoded.email, emailVerificationToken: token });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng hoặc token không khớp' });
    }

    // Kích hoạt tài khoản
    user.status = 'active';
    user.emailVerificationToken = null;
    await user.save();

    // Gửi email chào mừng
    try {
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email: user.email,
      });
    } catch (emailError) {
      console.error(`Lỗi gửi email chào mừng cho ${user.email}:`, emailError.message);
    }

    res.status(200).json({ message: 'Xác thực email thành công! Bạn có thể đăng nhập.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Quên mật khẩu
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }

    // Tạo token đặt lại mật khẩu
    const resetToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '1h' }
    );

    // Lưu token vào user
    user.passwordResetToken = resetToken;
    await user.save();

    // Gửi email đặt lại mật khẩu
    try {
      const resetUrl = `http://localhost:10000/api/users/reset-password/${resetToken}`;
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email,
        subject: 'Đặt lại mật khẩu của bạn 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Đặt lại mật khẩu</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng nhấp vào nút dưới đây để đặt lại mật khẩu của bạn:
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Đặt lại mật khẩu</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 0;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Link này sẽ hết hạn sau 1 giờ.
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a></p>
            </div>
          </div>
        `,
      });
      res.status(200).json({ message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.' });
    } catch (emailError) {
      console.error(`Lỗi gửi email cho ${email}:`, emailError.message);
      res.status(500).json({ message: 'Lỗi khi gửi email đặt lại mật khẩu' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Đặt lại mật khẩu
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
    } catch (err) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await userModel.findOne({ email: decoded.email, passwordResetToken: token });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng hoặc token không khớp' });
    }

    // Cập nhật mật khẩu
    user.password = newPassword; // Sẽ được băm bởi middleware
    user.passwordResetToken = null;
    await user.save();

    // Gửi email thông báo
    try {
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email: user.email,
        subject: 'Mật khẩu của bạn đã được đặt lại 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Mật khẩu đã được đặt lại</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Mật khẩu của bạn đã được đặt lại thành công. Nếu bạn không thực hiện hành động này, vui lòng liên hệ hỗ trợ ngay lập tức.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://purebotanica.com/login" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Đăng nhập ngay!</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo cho ${user.email}:`, emailError.message);
    }

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email không tồn tại' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản chưa được kích hoạt. Vui lòng xác thực email.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '1h' }
    );

    res.json({ token, message: 'Đăng nhập thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Middleware kiểm tra token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) {
    return res.status(403).json({ message: 'Không có token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan', (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token đã hết hạn' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token không hợp lệ' });
      }
      return res.status(401).json({ message: 'Lỗi xác thực token' });
    }
    req.userId = decoded.id;
    req.user = decoded; // Lưu toàn bộ decoded để dùng role
    next();
  });
};

// Lấy thông tin người dùng
const getUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId, { password: 0, emailVerificationToken: 0, passwordResetToken: 0 });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Lấy tất cả người dùng
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}, { password: 0, emailVerificationToken: 0, passwordResetToken: 0 });
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'Không có người dùng' });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Lấy người dùng theo ID
const getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id, { password: 0, emailVerificationToken: 0, passwordResetToken: 0 });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Cập nhật người dùng
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật người dùng này' });
    }
    const { username, phone, email, address, birthday, status, role } = req.body;
    const user = await userModel.findByIdAndUpdate(
      userId,
      { username, phone, email, address, birthday, status, role },
      { new: true, select: '-password -emailVerificationToken -passwordResetToken' }
    );
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Xóa người dùng
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa người dùng này' });
    }
    const user = await userModel.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Thay đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.id;
    if (req.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền đổi mật khẩu' });
    }
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }

    user.password = newPassword;
    await user.save();

    // Gửi email thông báo
    try {
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email: user.email,
        subject: 'Mật khẩu của bạn đã được thay đổi 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Mật khẩu đã được thay đổi</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Mật khẩu của bạn đã được thay đổi thành công. Nếu bạn không thực hiện hành động này, vui lòng liên hệ hỗ trợ ngay lập tức.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://purebotanica.com/login" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Đăng nhập ngay!</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a></p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo cho ${user.email}:`, emailError.message);
    }

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
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