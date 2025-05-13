const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();  // Sử dụng Router thay vì app.post

require('dotenv').config(); // Thêm dotenv để quản lý biến môi trường

// Cấu hình transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Lấy từ biến môi trường
    pass: process.env.EMAIL_PASS, // Lấy từ biến môi trường
  },
});

// Hàm kiểm tra email hợp lệ
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// API route gửi email
router.post('/sendEmail', async (req, res) => {
  const { email, username } = req.body; // Thêm username để cá nhân hóa

  // Kiểm tra dữ liệu đầu vào
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: 'Email không hợp lệ' });
  }
  if (!username) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tên người dùng' });
  }

  const mailOptions = {
    from: `"Pure-Botanica" <${process.env.EMAIL_USER}>`, 
    to: email,
    subject: 'Chào mừng bạn đã đăng ký!',
    text: `Xin chào ${username},\nCảm ơn bạn đã đăng ký. `, 
    html: `
      <h3>Xin chào ${username},</h3>
      <p>Cảm ơn bạn đã đăng ký tài khoản!</p>
      <p>Chúng tôi gửi bạn mã giảm giá lần đầu tham đăng kí tài khoản 10%: Ducduydeptrai</p>
      <p>Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email đã được gửi:', info.response);
    return res.status(200).json({ message: 'Email xác nhận đã được gửi!' });
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    return res.status(500).json({ message: 'Lỗi khi gửi email', error: error.message });
  }
});

module.exports = router;  // Sử dụng router thay vì app
