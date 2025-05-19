const passport = require('passport');

const googleAuth = (req, res, next) => {
  console.log('Initiating Google Auth');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: true, // Đảm bảo sử dụng session
  })(req, res, next);
};

const googleAuthCallback = [
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:3000/user/login', // Redirect về frontend khi thất bại
    session: true,
  }),
  (req, res) => {
    try {
      console.log('Google Auth Callback - User:', req.user);
      if (!req.user || !req.user._id) {
        console.error('Invalid user in callback:', req.user);
        return res.status(401).json({ message: 'Lỗi xác thực', error: 'Invalid user' });
      }
      const token = require('jsonwebtoken').sign(
        { id: req.user._id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET || 'dinhthenhan',
        { expiresIn: '1h' }
      );
      console.log('Generated Token:', token);
      const callbackUrl = req.query.callback || 'http://localhost:3000/user/login';
      console.log('Redirecting to:', `${callbackUrl}?token=${token}`);
      res.redirect(`${callbackUrl}?token=${token}`);
    } catch (err) {
      console.error('Error in Google Auth Callback:', err.message, err.stack);
      res.status(500).json({ message: 'Lỗi xử lý đăng nhập Google', error: err.message });
    }
  },
];

module.exports = { googleAuth, googleAuthCallback };