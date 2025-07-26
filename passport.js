const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const User = mongoose.model('user');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Profile received:', profile);
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: profile.emails[0].value }] });

        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {
          const username = profile.displayName || profile.emails[0].value.split('@')[0];
          user = await new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            username: username,
          }).save();
          console.log('New user created:', user);

          // Tạo transporter cho nodemailer
          const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          // Gửi email chào mừng
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.email,
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
                    <p style="margin: 0 0 5px;">© ${new Date().getFullYear()} Pure-Botanica. All rights reserved.</p>
                    <p style="margin: 0;">
                      Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                      <a href="https://purebotanica.com" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
                    </p>
                  </div>
                </div>
              `,
            });
            console.log(`Đã gửi email chào mừng tới: ${user.email}`);
          } catch (emailError) {
            console.error(`Lỗi gửi email chào mừng cho ${user.email}:`, emailError.message);
          }
        }

        done(null, user);
      } catch (err) {
        console.error('Error in Google Strategy:', err.message, err.stack);
        done(err, null);
      }
    }
  )
);

module.exports = passport;