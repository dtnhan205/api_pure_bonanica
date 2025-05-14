const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const categoriesRouter = require('./routes/categoryRoutes');
const productsRouter = require('./routes/productsRouter');
const usersRouter = require('./routes/usersRouter');
const cartRouter = require('./routes/cartRouter');
const orderRouter = require('./routes/orderRouter');
const commentRouter = require('./routes/commentRouter');
const couponRouter = require('./routes/couponRouter');
const emailRouter = require('./routes/emailRouter');

require('dotenv').config();

const app = express();

// Log biến môi trường
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '****' : 'Không có EMAIL_PASS');
console.log('BASE_URL:', process.env.BASE_URL);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

// Kiểm tra biến môi trường bắt buộc
if (!process.env.JWT_SECRET) {
  console.error('Lỗi: JWT_SECRET không được định nghĩa trong .env');
  process.exit(1);
}
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Lỗi: EMAIL_USER hoặc EMAIL_PASS không được định nghĩa trong .env');
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3801', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3801', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200, 
}));
app.use(express.json());

// Log yêu cầu
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate limiting cho các route nhạy cảm
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 yêu cầu mỗi IP
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút',
});
app.use('/api/users/register', authLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/forgot-password', authLimiter);

// Kết nối MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dtn280705:dtn280705@api-pure-bonanica.hioxvef.mongodb.net/zeal?retryWrites=true&w=majority&appName=api-pure-bonanica';
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 50000
})
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch((err) => {
    console.error('Lỗi kết nối MongoDB:', err.message, err.stack);
    process.exit(1);
  });

mongoose.connection.on('connected', () => console.log('Mongoose đã kết nối với DB'));
mongoose.connection.on('error', (err) => console.error('Lỗi kết nối Mongoose:', err.message, err.stack));
mongoose.connection.on('disconnected', () => console.log('Mongoose đã ngắt kết nối'));

// Routes
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/api/carts', cartRouter);
app.use('/api/orders', orderRouter);
app.use('/api/comments', commentRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/email', emailRouter);
app.use(express.static('public'));

// Xử lý lỗi 404
app.use((req, res, next) => {
  res.status(404).json({ message: 'Tuyến đường không tồn tại' });
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error('Lỗi server:', err.message, err.stack);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

// Khởi động server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Đã đóng kết nối Mongoose do ứng dụng tắt');
  process.exit(0);
});