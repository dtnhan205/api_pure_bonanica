const passport = require('passport');
const jwt = require('jsonwebtoken');

const getFrontendUrl = (req) => {
  // Nếu request đến từ localhost → dùng localhost
  if (req.headers.host.includes('localhost')) {
    return 'http://localhost:3000';
  }
  // Ngược lại dùng domain thật
  return 'https://purebotanica.online';
};

const googleAuth = (req, res, next) => {
  console.log('Initiating Google Auth');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: true, // Dùng session
  })(req, res, next);
};

const googleAuthCallback = [
  (req, res, next) => {
    const FRONTEND_URL = getFrontendUrl(req);
    passport.authenticate('google', {
      failureRedirect: `${FRONTEND_URL}/user/login`,
      session: true,
    })(req, res, next);
  },
  (req, res) => {
    try {
      console.log('Google Auth Callback - User:', req.user);
      if (!req.user || !req.user._id) {
        console.error('Invalid user in callback:', req.user);
        return res.status(401).json({ message: 'Lỗi xác thực', error: 'Invalid user' });
      }

      const token = jwt.sign(
        { id: req.user._id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET || 'dinhthenhan',
        { expiresIn: '1h' }
      );
      console.log('Generated Token:', token);

      const FRONTEND_URL = getFrontendUrl(req);
      const callbackUrl = req.query.callback || `${FRONTEND_URL}/user/login`;
      console.log('Redirecting to:', `${callbackUrl}?token=${token}`);

      res.redirect(`${callbackUrl}?token=${token}`);
    } catch (err) {
      console.error('Error in Google Auth Callback:', err.message, err.stack);
      res.status(500).json({ message: 'Lỗi xử lý đăng nhập Google', error: err.message });
    }
  },
];

module.exports = { googleAuth, googleAuthCallback };
