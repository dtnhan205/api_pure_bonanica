const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const categoriesRouter = require('./routes/categoryRoutes');
const productsRouter = require('./routes/productsRouter');
const usersRouter = require('./routes/usersRouter');
const cartRouter = require('./routes/cartRouter');
const orderRouter = require('./routes/orderRouter');
const commentRouter = require('./routes/commentRouter');

require('dotenv').config();

const app = express();

// Log để kiểm tra biến môi trường
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('PORT:', process.env.PORT);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3801', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Kết nối MongoDB với Mongoose
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dtn280705:dtn280705@api-pure-bonanica.hioxvef.mongodb.net/zeal?retryWrites=true&w=majority&appName=api-pure-bonanica';

if (!MONGODB_URI) {
  console.error('Lỗi: MONGODB_URI không được định nghĩa. Vui lòng kiểm tra tệp .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000
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
app.use(express.static('public'));

// Xử lý lỗi 404 (tuyến đường không tồn tại)
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

// Xử lý khi ứng dụng bị tắt
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Đã đóng kết nối Mongoose do ứng dụng tắt');
  process.exit(0);
});