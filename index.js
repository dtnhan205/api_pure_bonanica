const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const categoriesRouter = require('./routes/categories');
const subCategoriesRouter = require('./routes/subCategories');
const productsRouter = require('./routes/products');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3801', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Kiểm tra MONGODB_URI
console.log('MONGODB_URI:', process.env.MONGODB_URI);
if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env file');
  process.exit(1);
}

// Kết nối MongoDB với Mongoose
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/categories', categoriesRouter);
app.use('/api/subcategories', subCategoriesRouter);
app.use('/api/products', productsRouter);

// Khởi động server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});