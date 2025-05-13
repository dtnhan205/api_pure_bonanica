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
    subject: subject || 'Chào mừng bạn đã đăng ký! 🌿',
    text: text || `Xin chào ${username},\nCảm ơn bạn đã đăng ký tài khoản! `,
    html: html || `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">
          <img src="https://api-zeal.onrender.com/images/logo_web.png" alt="Pure-Botanica Logo" style="max-width: 160px; margin-bottom: 10px;">
          <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Chào mừng bạn đến với Pure-Botanica!</h1>
        </div>
        <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
          <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${username},</h3>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
            Cảm ơn bạn đã gia nhập cộng đồng Pure-Botanica! Chúng tôi rất hào hứng được đồng hành cùng bạn trên hành trình chăm sóc sức khỏe và sắc đẹp tự nhiên.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Để chào mừng, đây là <strong>mã giảm giá 10%</strong> dành riêng cho lần mua sắm đầu tiên của bạn:
          </p>
          <div style="text-align: center; background-color: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #357E38; font-size: 20px; letter-spacing: 2px;">Ducduydeptrai</strong>
          </div>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://purebotanica.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Mua sắm ngay!</a>
          </div>
          <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 0;">
            Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
          <p style="margin: 0;">Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | <a href="https://purebotanica.com" style="color: #357E38; text-decoration: none;">purebotanica.com</a></p>
        </div>
      </div>
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
