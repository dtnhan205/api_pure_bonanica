// controllers/userController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const Joi = require('joi');
const User = require('../models/user');

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().required(),
  sdt: Joi.string().required(),
  email: Joi.string().required(),
  password: Joi.string().min(6).required(),
  trangThai: Joi.string().optional(),
  quyenHan: Joi.string().valid('user', 'admin').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

const updateSchema = Joi.object({
  name: Joi.string().optional(),
  sdt: Joi.string().optional(),
  email: Joi.string().optional(),
  avatar: Joi.string().optional(),
  trangThai: Joi.string().optional(),
  quyenHan: Joi.string().valid('user', 'admin').optional(),
  trangThaiKhan: Joi.string().optional(),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

// Validation middleware
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, __v: 0 });
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng nào' });
    }
    res.json({
      message: 'Lấy danh sách người dùng thành công',
      users,
    });
  } catch (error) {
    console.error('Lỗi khi lấy tất cả người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
};

// Get limited user list (for non-admins)
const getUserList = async (req, res) => {
  try {
    const users = await User.find({}, { name: 1, trangThai: 1, _id: 1 });
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng nào' });
    }
    res.json({
      message: 'Lấy danh sách người dùng thành công',
      users,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
};

// Register
const register = [
  validate(registerSchema),
  async (req, res) => {
    try {
      const { name, sdt, email, password, trangThai, quyenHan } = req.body;
      const checkUser = await User.findOne({ email });
      if (checkUser) {
        throw new Error('Email đã tồn tại');
      }

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
        name,
        sdt,
        email,
        password: hashPassword,
        trangThai: trangThai || 'online',
        ngayTao: Date.now(),
        quyenHan: quyenHan || 'user',
        avatar: req.file ? `/images/${req.file.filename}` : null,
      });

      const data = await newUser.save();
      const { password: _, ...userData } = data._doc;
      res.status(201).json({
        message: 'Đăng ký thành công',
        user: userData,
      });
    } catch (error) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400).json({ message: error.message });
    }
  },
];

// Login
const login = [
  validate(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const checkUser = await User.findOne({ email });
      if (!checkUser) {
        throw new Error('Email không tồn tại');
      }

      const isMatch = await bcrypt.compare(password, checkUser.password);
      if (!isMatch) {
        throw new Error('Mật khẩu không đúng');
      }

      const token = jwt.sign(
        { id: checkUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      res.json({ token, message: 'Đăng nhập thành công' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
];

// Verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) {
    return res.status(403).json({ message: 'Không có token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
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

// Get user info
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId, { password: 0 });
    if (!user) {
      throw new Error('Không tìm thấy user');
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Verify admin
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new Error('Không tìm thấy user');
    }
    if (user.quyenHan !== 'admin') {
      throw new Error('Không có quyền truy cập');
    }
    next();
  } catch (error) {
    res.status(403).json({ message: error.message });
  }
};

// Update user info
const updateUser = [
  validate(updateSchema),
  async (req, res) => {
    try {
      const { name, sdt, email, avatar, trangThai, quyenHan, trangThaiKhan } = req.body;
      const user = await User.findByIdAndUpdate(
        req.userId,
        { name, sdt, email, avatar, trangThai, quyenHan, trangThaiKhan },
        { new: true, select: '-password' }
      );
      if (!user) {
        throw new Error('Không tìm thấy user');
      }
      res.json({ message: 'Cập nhật thông tin thành công', user });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
];

// Change password
const changePassword = [
  validate(changePasswordSchema),
  async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await User.findById(req.userId);
      if (!user) {
        throw new Error('Không tìm thấy user');
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new Error('Mật khẩu cũ không đúng');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedNewPassword;
      await user.save();

      res.json({ message: 'Thay đổi mật khẩu thành công' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
];

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Không có file được upload');
    }

    const avatarPath = `/images/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: avatarPath },
      { new: true, select: '-password' }
    );

    if (!user) {
      throw new Error('Không tìm thấy user');
    }

    res.json({ message: 'Tải avatar thành công', user });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserList,
  register,
  login,
  verifyToken,
  getUser,
  verifyAdmin,
  updateUser,
  changePassword,
  uploadAvatar,
};