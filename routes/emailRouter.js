const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

require('dotenv').config();

// Kiểm tra biến môi trường
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error('EMAIL_USER hoặc EMAIL_PASS không được định nghĩa trong .env');
}

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Gửi email
router.post('/sendEmail', async (req, res) => {
  try {
    const { username, email, subject, html } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }
    if (!username) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tên người dùng' });
    }

    // Cung cấp subject mặc định nếu không có
    const emailSubject = subject || 'Chào mừng bạn đến với Pure-Botanica 🌿';

    // Cung cấp HTML mặc định nếu không có
    const emailHtml = html || `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0;">

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
    `;

    // Cấu hình email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: emailSubject,
      html: emailHtml,
    };

    // Gửi email
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email xác nhận đã được gửi!' });
  } catch (error) {
    console.error('Lỗi Nodemailer:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi khi gửi email', error: error.message });
  }
});

module.exports = router;