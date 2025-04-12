const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const dbName = "zeal"; 

let db;

async function connectToMongo() {
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

app.get('/api/products', async (req, res) => {
  try {
    const collection = db.collection('products');
    const data = await collection.find({}).toArray();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});