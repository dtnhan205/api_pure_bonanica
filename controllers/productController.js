const mongoose = require('mongoose');
const Product = require('../models/product');

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    // Lấy dữ liệu trước khi populate
    const productsBeforePopulate = await Product.find();
    console.log('Products before populate:', productsBeforePopulate);

    // Populate category
    const products = await Product.find().populate('category');
    console.log('Products after populate:', products);

    if (!products.length) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào' });
    }

    // Kiểm tra các sản phẩm có category null
    const invalidProducts = products.filter(product => !product.category);
    if (invalidProducts.length > 0) {
      console.warn('Sản phẩm với danh mục không hợp lệ:', invalidProducts);
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

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

  try {
    const product = await Product.findById(id).populate('category');

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
      name,
      price,
      distcountprice,
      description,
      category,
      stock,
      ingredients,
      usage_instructions,
      special
    } = req.body;

    // Kiểm tra category
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
    }

    const categoryExists = await mongoose.model('Category').findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: 'Danh mục không tồn tại' });
    }

    // Lấy đường dẫn ảnh sau khi upload
    const imagePaths = req.files?.map(file => file.filename) || [];

    const newProduct = new Product({
      name,
      price,
      distcountprice,
      description,
      images: imagePaths,
      category,
      stock,
      ingredients: ingredients ? JSON.parse(ingredients) : [],
      usage_instructions: usage_instructions ? JSON.parse(usage_instructions) : [],
      special: special ? JSON.parse(special) : [],
    });

    await newProduct.save();
    await newProduct.populate('category', '_id name');

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

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

  try {
    const { category } = req.body;

    // Kiểm tra category (nếu được cung cấp)
    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
    }
    if (category) {
      const categoryExists = await mongoose.model('Category').findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: 'Danh mục không tồn tại' });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        distcountprice: req.body.distcountprice,
        images: req.body.images || [],
        category: category || undefined,
        stock: req.body.stock,
        ingredients: req.body.ingredients || [],
        usage_instructions: req.body.usage_instructions || [],
        special: req.body.special || [],
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

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID sản phẩm không hợp lệ' });
  }

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
    const products = await Product.find({ distcountprice: { $eq: null } })
      .select('name price')
      .populate('category', 'name');

    const count = products.length;

    if (!count) {
      return res.status(404).json({ message: 'Không có sản phẩm nào không có giá giảm' });
    }

    res.json({
      message: 'Danh sách sản phẩm không có giá giảm',
      count: count,
      products: products
    });
  } catch (err) {
    console.error('GET /api/products/no-discount error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};