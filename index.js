const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// Thêm cors
const cors = require('cors');

const app = express();

// Sử dụng middleware cors
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3801','http://localhost:3001','http://localhost:3002'], // Cho phép cả 2 origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Phần còn lại của code giữ nguyên
let db;
const uri = process.env.MONGO_URI;
const dbName = 'zeal';

async function connectToMongo() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db(dbName);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

connectToMongo();

app.get('/api/products', async (req, res) => {
  try {
    if (!db) {
      throw new Error("Database connection not established");
    }
    console.log("Fetching data from MongoDB...");
    const collection = db.collection('products');
    const data = await collection.find({}).toArray();
    console.log("Data fetched:", data);
    if (data.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }
    res.json(data);
  } catch (err) {
    console.error("Error in /api/products:", err);
    res.status(500).json({ error: err.message });
  }
});
// Endpoint mới: Lấy sản phẩm theo id
app.get('/api/products/:id', async (req, res) => {
  try {
    if (!db) {
      throw new Error("Database connection not established");
    }
    const { id } = req.params;

    // Kiểm tra id có phải là chuỗi hex 24 ký tự không
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let product;

    if (isValidObjectId) {
      // Nếu id hợp lệ, thử tìm theo ObjectId
      const collection = db.collection('products');
      product = await collection.findOne({ _id: new ObjectId(id) });
    }

    // Nếu không tìm thấy hoặc id không hợp lệ, thử tìm theo string
    if (!product) {
      const collection = db.collection('products');
      product = await collection.findOne({ _id: id });
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Error in /api/products/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
