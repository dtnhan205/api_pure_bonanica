const multer = require('multer');
const path = require('path');
const userModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Cấu hình multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './public/images');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const checkFile = (req, file, cb) => {
    const filetypes = /jpg|jpeg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Bạn chỉ được upload file ảnh (jpg, jpeg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: checkFile,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

// Đăng ký
const register = [
    upload.single('avatar'),
    async (req, res) => {
        try {
            const checkUser = await userModel.findOne({ email: req.body.email });
            if (checkUser) {
                throw new Error('Email đã tồn tại');
            }

            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(req.body.password, salt);

            const newUser = new userModel({
                email: req.body.email,
                password: hashPassword,
                avatar: req.file ? `/images/${req.file.filename}` : null,
                role: 'user'
            });

            const data = await newUser.save();
            const { password, ...userData } = data._doc;
            res.status(201).json({
                message: 'Đăng ký thành công',
                user: userData
            });
        } catch (error) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ message: error.message });
        }
    }
];

// Đăng nhập
const login = [
    upload.single('avatar'), // Không cần upload avatar khi login, có thể bỏ
    async (req, res) => {
        try {
            const checkUser = await userModel.findOne({ email: req.body.email });
            if (!checkUser) {
                throw new Error('Email không tồn tại');
            }

            const isMatch = await bcrypt.compare(req.body.password, checkUser.password);
            if (!isMatch) {
                throw new Error('Mật khẩu không đúng');
            }

            const token = jwt.sign({ id: checkUser._id }, 'conguoiyeuchua', { expiresIn: '1h' });
            res.json({ token, message: 'Đăng nhập thành công' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
];

// Middleware kiểm tra token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.slice(7);
    if (!token) {
        return res.status(403).json({ message: 'Không có token' });
    }

    jwt.verify(token, 'conguoiyeuchua', (err, decoded) => {
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

// Middleware kiểm tra admin
const verifyAdmin = async (req, res, next) => {
    try {
        const user = await userModel.findById(req.userId);
        if (!user) {
            throw new Error('Không tìm thấy user');
        }
        if (user.role !== 'admin') {
            throw new Error('Không có quyền truy cập');
        }
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cập nhật thông tin người dùng
const updateUser = async (req, res) => {
    try {
        const { email, avatar } = req.body;
        const user = await userModel.findByIdAndUpdate(
            req.userId,
            { email, avatar },
            { new: true, select: '-password' }
        );
        if (!user) {
            throw new Error('Không tìm thấy user');
        }
        res.json({ message: 'Cập nhật thông tin thành công', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Thay đổi mật khẩu
const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await userModel.findById(req.userId);
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
        res.status(500).json({ message: error.message });
    }
};

// Upload avatar
const uploadAvatar = [
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                throw new Error('Không có file được upload');
            }

            const avatarPath = `/images/${req.file.filename}`;
            res.json({ avatarPath });
        } catch (error) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ message: error.message });
        }
    }
];

module.exports = { register, login, getUser, verifyToken, verifyAdmin, updateUser, changePassword, uploadAvatar };