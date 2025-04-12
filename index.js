const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Thêm cors
const cors = require('cors');

const app = express();

// Sử dụng middleware cors
app.use(cors({
  origin: 'http://localhost:3801', // Cho phép origin từ frontend
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
