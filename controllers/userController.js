const userModel = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const SALT_ROUNDS = 10;

const register = async (req, res) => {
  try {
    const { username, phone, email, password, address, birthday, listOrder } = req.body;

    // Validate input
    if (!username || !phone || !email || !password) {
      return res.status(400).json({ message: 'Tất cả các trường username, phone, email, password đều bắt buộc' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }

    // Check if email exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    // Create user (password will be hashed by middleware)
    const user = new userModel({
      username,
      phone,
      email,
      password,
      address: address || '',
      birthday: birthday ? new Date(birthday) : null,
      listOrder: Array.isArray(listOrder) ? listOrder : [],
      status: 'active', // Set status to active
      role: 'user',
    });

    const savedUser = await user.save();
    console.log(`Đã lưu user: ${email}, hash mật khẩu: ${savedUser.password}`);

    // Send welcome email
    try {
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username,
        email,
        subject: `Chào mừng ${username} đến với Pure-Botanica!`,
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 0;">
            <div style="text-align: center; background-color: #357E38; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Chào mừng đến với Pure-Botanica!</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
              <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px;">Xin chào ${username},</h3>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Chúng tôi rất vui khi bạn đã gia nhập cộng đồng <strong>Pure-Botanica</strong>! Hãy cùng khám phá hành trình chăm sóc sức khỏe và sắc đẹp tự nhiên với các sản phẩm tinh khiết từ thiên nhiên.
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 25px;">
                Để chào mừng bạn, chúng tôi dành tặng <strong>mã giảm giá 10%</strong> cho lần mua sắm đầu tiên:
              </p>
              <div style="text-align: center; background-color: #e8f5e9; padding: 15px 20px; border-radius: 8px; margin: 0 0 25px; border: 1px dashed #357E38;">
                <strong style="color: #357E38; font-size: 18px; letter-spacing: 1px; font-weight: 600;">Ducduydeptrai</strong>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://purebotanica.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Mua sắm ngay</a>
              </div>
              <p style="color: #777; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
                Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.
              </p>
            </div>
            <div style="text-align: center; padding: 20px 0; color: #666; font-size: 12px;">
              <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                </a>
                <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                </a>
              </div>
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">
                Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                <a href="https://purebotanica.com" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
              </p>
            </div>
          </div>
        `,
      });
      console.log(`Đã gửi email chào mừng tới: ${email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email chào mừng cho ${email}:`, emailError.message);
    }

    // Exclude sensitive fields from response
    const { password: _, ...userData } = savedUser._doc;
    res.status(201).json({ message: 'Đăng ký thành công! Bạn có thể đăng nhập.', user: userData });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Đang đăng nhập với email:', email);

    // Validate input
    if (!email || !password) {
      console.log('Thiếu email hoặc mật khẩu');
      return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc' });
    }

    // Find user
    const user = await userModel.findOne({ email });
    if (!user) {
      console.log('Không tìm thấy user với email:', email);
      return res.status(401).json({ message: 'Email không tồn tại' });
    }

    // Check account status
    if (user.status !== 'active') {
      console.log('Tài khoản không hoạt động:', email);
      return res.status(403).json({ message: 'Tài khoản không hoạt động. Vui lòng liên hệ hỗ trợ.' });
    }

    console.log('Hash mật khẩu trong DB:', user.password);

    // Check password
    const match = await bcrypt.compare(password, user.password);
    console.log('Kết quả kiểm tra mật khẩu:', match ? 'Đúng' : 'Sai');

    if (!match) {
      return res.status(401).json({ message: 'Mật khẩu không đúng' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '1h' }
    );

    console.log('Đăng nhập thành công:', email);
    res.json({ token, message: 'Đăng nhập thành công', user: { id: user._id, email: user.email, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Lỗi trong quá trình đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

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

    // Create password reset token
    const resetToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || 'dinhthenhan',
      { expiresIn: '1h' }
    );

    // Save token to user
    user.passwordResetToken = resetToken;
    await user.save();

    // Send password reset email
    try {
      const resetUrl = `http://localhost:3000/user/resetpass/${resetToken}`;
      await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email,
        subject: 'Đặt lại mật khẩu của bạn 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #357E38; font-size: 26px; font WEIGHT: 600; margin: 0;">Đặt lại mật khẩu</h1>
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

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dinhthenhan');
      console.log('Token hợp lệ, email:', decoded.email);
    } catch (err) {
      console.error('Lỗi xác minh JWT:', err.message);
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Find user
    const user = await userModel.findOne({ email: decoded.email, passwordResetToken: token });
    if (!user) {
      return res.status(404).json({ message: 'Token không khớp hoặc người dùng không tồn tại' });
    }

    // Update password
    user.password = newPassword; // Middleware will hash it
    user.passwordResetToken = null;
    await user.save();

    // Send confirmation email
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
                Mật khẩu của bạn đã được đặt lại thành công. Bạn có thể sử dụng mật khẩu mới để đăng nhập.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://purebotanica.com/login" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Đăng nhập ngay</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a></p>
            </div>
          </div>
        `,
      });
      console.log(`Đã gửi email thông báo tới: ${user.email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo cho ${user.email}:`, emailError.message);
    }

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

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
    req.user = decoded;
    next();
  });
};

const getUser = async (req, res) => {
  try {
    const userId = req.query.id;
    console.log('Received userId:', userId);
    if (!userId) {
      return res.status(400).json({ message: 'Thiếu tham số userId' });
    }
    const user = await userModel.findById(userId, {
      password: 0,
      passwordResetToken: 0,
      emailVerificationToken: 0
    });
    console.log('User found:', user);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(user); // Bao gồm temporaryAddress
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getTemporaryAddresses = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ token
    const user = await userModel.findById(userId, {
      temporaryAddress1: 1,
      temporaryAddress2: 1,
      _id: 0
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json({
      temporaryAddress1: user.temporaryAddress1,
      temporaryAddress2: user.temporaryAddress2
    });
  } catch (error) {
    console.error('Lỗi khi lấy địa chỉ tạm thời:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}, { password: 0, passwordResetToken: 0 });
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'Không có người dùng' });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id, { password: 0, passwordResetToken: 0 });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
const addFavoriteProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'ProductId không hợp lệ' });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (!user.favoriteProducts.includes(productId)) {
      user.favoriteProducts.push(productId);
      await user.save();
    }

    res.json({ message: 'Thêm sản phẩm yêu thích thành công', favoriteProducts: user.favoriteProducts });
  } catch (error) {
    console.error('Lỗi khi thêm sản phẩm yêu thích:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
const removeFavoriteProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'ProductId không hợp lệ' });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const index = user.favoriteProducts.indexOf(productId);
    if (index !== -1) {
      user.favoriteProducts.splice(index, 1);
      await user.save();
    }

    res.json({ message: 'Xóa sản phẩm yêu thích thành công', favoriteProducts: user.favoriteProducts });
  } catch (error) {
    console.error('Lỗi khi xóa sản phẩm yêu thích:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getFavoriteProducts = async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Request context for /favorite-products:`, {
      user: req.user,
      userId: req.user ? req.user._id : 'undefined',
      params: req.params,
      query: req.query,
      headers: req.headers,
      originalUrl: req.originalUrl,
    });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Người dùng không được xác thực' });
    }

    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'User ID không hợp lệ', received: userId });
    }

    const user = await userModel
      .findById(userId)
      .populate({
        path: 'favoriteProducts',
        select: 'name images active', // Lấy trực tiếp active thay vì isActive
        populate: { path: 'id_category', select: 'status' } // Populate id_category và status
      });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Thêm isActive vào response dựa trên logic virtual nếu cần
    const favoriteProducts = user.favoriteProducts.map(product => ({
      ...product.toObject(),
      isActive: product.isActive // Sử dụng virtual field
    }));

    res.json({ favoriteProducts });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi lấy sản phẩm yêu thích:`, error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log("Updating user:", {
      userId,
      body: req.body,
      requesterId: req.user._id.toString(),
      role: req.user.role,
    });

    // Kiểm tra quyền truy cập
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      console.log("Access denied:", {
        userId,
        requesterId: req.user._id.toString(),
        role: req.user.role,
      });
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật người dùng này' });
    }

    const { username, phone, email, address, birthday, status, role } = req.body;

    // Kiểm tra email trùng lặp
    if (email) {
      const existingUser = await userModel.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        console.log("Email already exists:", email);
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    // Tạo object updateData chỉ chứa các trường hợp lệ
    const updateData = {};
    if (username && username.trim()) updateData.username = username.trim();
    if (email && email.trim()) updateData.email = email.trim();
    if (phone && phone.trim()) updateData.phone = phone.trim();
    if (address && address.trim()) updateData.address = address.trim();
    if (birthday && !isNaN(new Date(birthday).getTime())) updateData.birthday = new Date(birthday);

    // Chỉ admin mới được cập nhật status và role
    if (req.user.role === 'admin') {
      if (status !== undefined) updateData.status = status;
      if (role !== undefined) updateData.role = role;
    }

    // Nếu không có trường nào để cập nhật, trả về thành công ngay
    if (Object.keys(updateData).length === 0) {
      console.log("No changes to update for user:", userId);
      const user = await userModel.findById(userId).select('-password -passwordResetToken');
      return res.status(200).json({ message: 'Không có thay đổi để cập nhật', user });
    }

    // Cập nhật user
    const user = await userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true, select: '-password -passwordResetToken' }
    );

    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    console.log("User updated successfully:", user);
    return res.status(200).json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    console.error("Error in updateUser:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
    }
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') { // Thay req.userId
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

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.id;
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') { // Thay req.userId
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

    // Hash new password
    user.password = newPassword; // Middleware will hash it
    await user.save();

    // Send confirmation email
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
  forgotPassword,
  resetPassword,
  verifyToken,
  getUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  getTemporaryAddresses,
  addFavoriteProduct,
  removeFavoriteProduct,
  getFavoriteProducts,
};