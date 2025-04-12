const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const itemsRouter = require('./routes/items');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors()); // Cho phép tất cả nguồn truy cập
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
const itemsRouter = require('./routes/items');
app.use('/api/items', itemsRouter);

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));