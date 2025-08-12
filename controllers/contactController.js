const Contact = require('../models/contact');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Cấu hình nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Sử dụng App Password nếu bật 2FA
  },
});

exports.createContact = async (req, res) => {
  try {
    const { fullName, email, phone, message } = req.body;

    // Validate input
    if (!fullName || !email) {
      return res.status(400).json({ message: 'Họ và tên và email là bắt buộc' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    // Create new contact
    const newContact = new Contact({
      fullName,
      email,
      phone: phone || '',
      message: message || '',
    });

    await newContact.save();

    // Send thank-you email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Cảm ơn bạn đã liên hệ với Pure-Botanica 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Cảm ơn bạn đã liên hệ!</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${fullName},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Cảm ơn bạn đã liên hệ với <strong>Pure-Botanica</strong>. Chúng tôi đã nhận được tin nhắn của bạn và đội ngũ hỗ trợ sẽ phản hồi trong vòng <strong>3-4 ngày làm việc</strong>.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Nếu bạn có thêm câu hỏi hoặc cần hỗ trợ ngay, vui lòng liên hệ qua email hoặc hotline của chúng tôi.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
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
      console.log(`Đã gửi email cảm ơn tới: ${email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email cảm ơn cho ${email}:`, emailError.message);
      // Không trả về lỗi vì việc gửi email không ảnh hưởng đến việc lưu liên hệ
    }

    res.status(201).json({ message: 'Gửi liên hệ thành công', contact: newContact });
  } catch (error) {
    console.error('Lỗi khi gửi liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi gửi liên hệ' });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ contacts, totalPages: 1 });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách liên hệ' });
  }
};

exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }
    res.status(200).json(contact);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin liên hệ' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }

    if (status !== 'Đã xử lý' && status !== 'Chưa xử lý') {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ cho phép "Chưa xử lý" hoặc "Đã xử lý".' });
    }

    if (contact.status === 'Đã xử lý') {
      return res.status(400).json({ message: 'Liên hệ đã được xử lý, không thể cập nhật lại trạng thái.' });
    }

    if (status === 'Đã xử lý' && contact.status === 'Chưa xử lý') {
      contact.status = status;
    } else {
      return res.status(400).json({ message: 'Chỉ có thể cập nhật trạng thái từ "Chưa xử lý" thành "Đã xử lý".' });
    }

    await contact.save();
    res.status(200).json({ message: 'Cập nhật trạng thái thành công', contact });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi cập nhật trạng thái liên hệ' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }

    await contact.deleteOne();
    res.status(200).json({ message: 'Xóa liên hệ thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi xóa liên hệ' });
  }
};