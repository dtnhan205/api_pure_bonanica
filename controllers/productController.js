const mongoose = require('mongoose');
const Product = require('../models/product');

// Get all products (chỉ lấy sản phẩm có status: 'show')
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'show' });
    if (!products.length) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào' });
    }
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findOne({ _id: id, status: 'show' });
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json(product);
  } catch (err) {
    console.error(`GET /api/products/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const {
      price,
      discountPrice,
      description,
      color,
      brand,
      images,
      ingredients,
      special,
      stock,
      status, // Thêm status từ req.body
    } = req.body;

    const imagePaths = req.files?.map(file => file.filename) || [];

    const parseArrayField = (value) => {
      if (!value) return [];
      return value.split(',').map(item => item.trim());
    };

    const newProduct = new Product({
      _id: req.body._id || Date.now(),
      price,
      discountPrice,
      description,
      color,
      brand,
      images: imagePaths,
      ingredients: parseArrayField(ingredients),
      special: parseArrayField(special),
      stock,
      status: status || 'show', // Mặc định là 'show' nếu không được cung cấp
    });

    await newProduct.save();
    res.status(201).json({
      message: 'Tạo sản phẩm thành công',
      product: newProduct,
    });
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Update a product by ID
exports.updateProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        price: req.body.price,
        discountPrice: req.body.discountPrice,
        description: req.body.description,
        color: req.body.color,
        brand: req.body.brand,
        images: req.body.images || [],
        ingredients: req.body.ingredients || [],
        special: req.body.special || [],
        stock: req.body.stock,
        status: req.body.status, // Cập nhật trạng thái hidden/show
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
    }

    res.json({
      message: 'Cập nhật sản phẩm thành công',
      product: updatedProduct,
    });
  } catch (err) {
    console.error(`PUT /api/products/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
};

// Delete a product by ID
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
    }
    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (err) {
    console.error(`DELETE /api/products/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get products without discount
exports.getProductsWithoutDiscount = async (req, res) => {
  try {
    const products = await Product.find({ discountPrice: { $eq: null }, status: 'show' })
      .select('price');

    const count = products.length;
    if (!count) {
      return res.status(404).json({ message: 'Không có sản phẩm nào không có giá giảm' });
    }

    res.json({
      message: 'Danh sách sản phẩm không có giá giảm',
      count: count,
      products: products,
    });
  } catch (err) {
    console.error('GET /api/products/no-discount error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Toggle product visibility (Chuyển đổi giữa hidden và show)
exports.toggleProductVisibility = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    product.status = product.status === 'show' ? 'hidden' : 'show'; 
    await product.save();

    res.json({
      message: `Sản phẩm đã được ${product.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      product,
    });
  } catch (err) {
    console.error(`PUT /api/products/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};