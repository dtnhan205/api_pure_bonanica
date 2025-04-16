const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/product');

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find()
      .populate('category')
      .populate('subcategory');

    if (!products.length) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào' });
    }

    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

  try {
    const product = await Product.findById(id)
      .populate('category')
      .populate('subcategory');

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json(product);
  } catch (err) {
    console.error(`GET /api/products/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// POST (tạo sản phẩm mới)
router.post('/', async (req, res) => {
  try {
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      images: req.body.images || [], 
      category: req.body.category,
      stock: req.body.stock,
      subcategory: req.body.subcategory,
      ingredients: req.body.ingredients || [],
      usage_instructions: req.body.usage_instructions || [],
      special: req.body.special || []
    });
    await newProduct.save();

    res.status(201).json({
      message: 'Tạo sản phẩm thành công',
      product: newProduct
    });
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(400).json({ error: err.message });
  }
});

// PUT (cập nhật sản phẩm)
router.put('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        images: req.body.images || [], 
        category: req.body.category,
        stock: req.body.stock,
        subcategory: req.body.subcategory,
        ingredients: req.body.ingredients || [], 
        usage_instructions: req.body.usage_instructions || [],
        special: req.body.special || []
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
    }

    res.json({
      message: 'Cập nhật sản phẩm thành công',
      product: updatedProduct
    });
  } catch (err) {
    console.error(`PUT /api/products/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE (xoá sản phẩm)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xoá' });
    }

    res.json({ message: 'Xoá sản phẩm thành công' });
  } catch (err) {
    console.error(`DELETE /api/products/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;