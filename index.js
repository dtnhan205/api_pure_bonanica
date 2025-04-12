require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const dbName = "zeal";

let db;

async function connectToMongo() {
  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db(dbName);
  } catch (err) {
    console.error(err);
  }
}

connectToMongo();

app.use(express.json());

app.get('/', (req, res) => {
  res.send("Server is running!");
});

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

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
