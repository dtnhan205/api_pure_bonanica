const userModel = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Thêm axios để gọi API gửi email

// Đăng ký người dùng
const register = async (req, res) => {
  try {
    const { username, phone, email, password, address, birthday, listOrder, status } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !phone || !email || !password) {
      return res.status(400).json({ message: 'Tất cả các trường username, phone, email, password đều bắt buộc' });
    }

    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Các trường username, phone, email, password phải là chuỗi' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }
    if (isNaN(phone) || phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ message: 'Số điện thoại phải từ 10 đến 15 ký tự và phải là số' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }

    if (address && typeof address !== 'string') {
      return res.status(400).json({ message: 'Địa chỉ phải là chuỗi' });
    }
    if (birthday && typeof birthday !== 'string') {
      return res.status(400).json({ message: 'Ngày sinh phải là chuỗi (định dạng YYYY-MM-DD)' });
    }
    if (listOrder && !Array.isArray(listOrder)) {
      return res.status(400).json({ message: 'listOrder phải là một mảng' });
    }
    if (status && typeof status !== 'string') {
      return res.status(400).json({ message: 'Trạng thái phải là chuỗi' });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới với giá trị mặc định
    const user = new userModel({
      username,
      phone,
      email,
      password: hashedPassword,
      address: address || '',
      birthday: birthday || '',
      listOrder: Array.isArray(listOrder) ? listOrder : [],
      status: status && typeof status === 'string' ? status : 'active',
    });

    // Lưu user vào database
    const savedUser = await user.save();

    // Gọi API gửi email xác nhận
    try {
      const emailResponse = await axios.post('http://localhost:10000/api/email/sendEmail', {
        username,
        email,
      });
      console.log('Email response:', emailResponse.data);
    } catch (emailError) {
      console.error('Lỗi khi gửi email:', emailError.message);
      // Tiếp tục trả về phản hồi thành công ngay cả khi email thất bại
    }

    // Loại bỏ password khỏi response
    const { password: _, ...userData } = savedUser._doc;
    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.', user: userData });
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
      'dinhthenhan',
      { expiresIn: '1h' }
    );

    res.json({ token, message: 'Đăng nhập thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Middleware kiểm tra token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) {
    return res.status(403).json({ message: 'Không có token' });
  }

  jwt.verify(token, 'dinhthenhan', (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token đã hết hạn' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token không hợp lệ' });
      }
      return res.status(401).json({ message: 'Lỗi xác thực token' });
    }
    req.userId = decoded.id;
    next();
  });
};

// Lấy thông tin người dùng
const getUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId, { password: 0 });
    if (!user) {
      throw new Error('Không tìm thấy user');
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả người dùng
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}, { password: 0 });
    if (!users || users.length === 0) throw new Error('Không có người dùng');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy người dùng theo ID
const getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id, { password: 0 });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật người dùng
const updateUser = async (req, res) => {
  try {
    const { username, phone, email, address, birthday, status, role } = req.body;
    const user = await userModel.findByIdAndUpdate(
      req.params.id,
      { username, phone, email, address, birthday, status, role },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    res.json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa người dùng
const deleteUser = async (req, res) => {
  try {
    const user = await userModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thay đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await userModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

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
  deleteUser,
};