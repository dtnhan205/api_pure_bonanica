const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const categoriesRouter = require('./routes/categoryRoutes');
const productsRouter = require('./routes/productsRouter');
const usersRouter = require('./routes/usersRouter');
const cartRouter = require('./routes/cartRouter');
const orderRouter = require('./routes/orderRouter');
const commentRouter = require('./routes/commentRouter');
const couponRouter = require('./routes/couponRouter');
const emailRouter = require('./routes/emailRouter');

require('dotenv').config();

// Kiểm tra biến môi trường bắt buộc
const requiredEnv = ['MONGODB_URI', 'PORT', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'BASE_URL'];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`Lỗi: ${env} không được định nghĩa trong .env`);
    process.exit(1);
  }
}

// Log biến môi trường (ẩn thông tin nhạy cảm)
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', '****');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', '****');
console.log('BASE_URL:', process.env.BASE_URL);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

const app = express();

// Cấu hình CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3801', 'http://localhost:3001', 'http://localhost:3002'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 50000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
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
console.log('Route /api/users/reset-password đã được đăng ký');
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