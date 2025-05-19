const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/user');
const mongoose = require('mongoose'); // Thêm mongoose để kiểm tra ObjectId
require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/users/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('GoogleStrategy - Profile:', profile);
        if (!profile.id || !profile.emails || !profile.emails.length) {
          console.error('Invalid Google profile:', profile);
          return done(new Error('Invalid Google profile data'), null);
        }

        let user = await User.findOne({ googleId: profile.id });
        console.log('User found by googleId:', user);

        if (!user) {
          console.log('No existing user found with googleId:', profile.id);
          return done(new Error('Tài khoản Google không được liên kết. Vui lòng đăng ký bằng email và mật khẩu trước.'), null);
        }

        console.log('Existing user updated:', user);
        user.username = profile.displayName || user.username;
        user.email = profile.emails[0].value;
        await user.save();

        if (!user || !user._id) {
          console.error('Invalid user object after processing:', user);
          return done(new Error('Failed to process user'), null);
        }

        console.log('Passing user to done:', user._id);
        return done(null, user);
      } catch (err) {
        console.error('GoogleStrategy Error:', err.message, err.stack);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log('Serialize User - User:', user);
  if (!user || !user._id || !mongoose.Types.ObjectId.isValid(user._id)) {
    console.error('Invalid user object in serialize:', user);
    return done(new Error('Invalid user object in serialize'), null);
  }
  console.log('Serializing user._id:', user._id.toString());
  done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
  console.log('Deserialize User - ID:', id);
  try {
    // Kiểm tra nếu id là ObjectId hợp lệ
    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      console.error('Invalid ObjectId format or type:', id);
      return done(null, false); // Không trả lỗi, chỉ bỏ qua session
    }
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found for ID:', id);
      return done(null, false);
    }
    console.log('Deserialized User:', user);
    done(null, user);
  } catch (err) {
    console.error('Deserialize Error:', err.message, err.stack);
    done(err, null);
  }
});

module.exports = passport;