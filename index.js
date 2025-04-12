const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error(err);
    }
}

connectDB();

app.get('/products', async (req, res) => {
    try {
        const database = client.db('bonanica');
        const products = database.collection('products');
        const result = await products.find({}).toArray();
        res.json(result);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
