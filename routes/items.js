const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Kết nối MongoDB
async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error(err);
    }
}
connectDB();

// Route GET /products
router.get('/', async (req, res) => {
    try {
        const database = client.db('bonanica');
        const products = database.collection('products');
        const result = await products.find({}).toArray();
        res.json(result);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;