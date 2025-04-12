const express = require('express');
const connectDB = require('./config/db');
const itemRoutes = require('./routes/items');
// const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Kết nối MongoDB Atlas
connectDB();

// Middleware
app.use(express.json());

// Routes
app.use('/products', itemRoutes);

// Xử lý lỗi
// app.use(errorHandler);

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
