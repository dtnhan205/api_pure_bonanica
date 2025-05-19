const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
require('dotenv').config();

const User = mongoose.model('users'); // Sử dụng schema User đã định nghĩa

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
        // Tìm người dùng dựa trên googleId hoặc email
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: profile.emails[0].value }] });

        if (user) {
          // Nếu người dùng tồn tại nhưng chưa liên kết Google
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {
          // Tạo người dùng mới
          const username = profile.displayName || profile.emails[0].value.split('@')[0]; // Lấy username từ displayName hoặc phần trước @ của email
          user = await new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            username: username, // Đảm bảo có username nếu cần
          }).save();
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

module.exports = passport;