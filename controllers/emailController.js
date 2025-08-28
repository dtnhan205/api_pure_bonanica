const nodemailer = require('nodemailer');
require('dotenv').config();

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Hàm kiểm tra email hợp lệ
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Controller gửi email
exports.sendEmail = async (req, res) => {
    const { email, username, subject, html } = req.body;

    // Log request body để debug
    console.log('Request body received in sendEmail:', JSON.stringify(req.body, null, 2));

    // Kiểm tra dữ liệu đầu vào
    if (!email || !isValidEmail(email)) {
        console.error('Invalid email:', email);
        return res.status(400).json({ message: 'Email không hợp lệ' });
    }
    if (!username) {
        console.error('Missing username');
        return res.status(400).json({ message: 'Vui lòng cung cấp tên người dùng' });
    }

    // Sử dụng subject và html từ req.body nếu có, nếu không thì dùng mặc định
    const mailOptions = {
        from: `"Pure-Botanica" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject || `Chào mừng ${username} đến với Pure-Botanica!`,
        text: html ? undefined : `Xin chào ${username},\nCảm ơn bạn đã đăng ký tài khoản!`,
        html: html || `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 0;">
                <!-- Header -->
                <div style="text-align: center; background-color: #357E38; padding: 20px; border-radius: 8px 8px 0 0;">
                    <img src="cid:logo_purebotanica" alt="Pure-Botanica Logo" style="max-width: 150px; margin-bottom: 10px;">
                    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Chào mừng đến với Pure-Botanica!</h1>
                </div>
                <!-- Body -->
                <div style="background-color: #ffffff; padding: 30px 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px;">Xin chào ${username},</h3>
                    <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                        Chúng tôi rất vui khi bạn đã gia nhập cộng đồng <strong>Pure-Botanica</strong>! Hãy cùng khám phá hành trình chăm sóc sức khỏe và sắc đẹp tự nhiên với các sản phẩm tinh khiết từ thiên nhiên.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://purebotanica.online" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Mua sắm ngay</a>
                    </div>
                    <p style="color: #777; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
                        Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.
                    </p>
                </div>
                <!-- Footer -->
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
                        <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
                    </p>
                </div>
            </div>
        `,
        attachments: [
            {
                filename: 'logo_web.png',
                path: 'http://localhost:10000/images/logo_email_register.png',
                cid: 'logo_purebotanica',
            },
        ],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        return res.status(200).json({ message: 'Email đã được gửi thành công!' });
    } catch (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ message: 'Lỗi khi gửi email', error: error.message });
    }
};
