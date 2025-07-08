const mongoose = require('mongoose');
const Product = require('../models/product');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');

// Hàm tạo slug từ tên sản phẩm với kiểm tra tên duy nhất
const generateSlug = async (name, currentProductId = null) => {
  // Kiểm tra xem tên sản phẩm đã tồn tại chưa (không phân biệt hoa thường)
  const nameExists = await Product.findOne({ 
    name: { $regex: `^${name}$`, $options: 'i' },
    _id: { $ne: currentProductId } // Loại trừ sản phẩm hiện tại khi cập nhật
  });

  if (nameExists) {
    throw new Error(`Tên sản phẩm "${name}" đã tồn tại`);
  }

  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  let uniqueSlug = baseSlug;

  // Kiểm tra tính duy nhất của slug
  const regex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i');
  const existingSlugs = await Product.find({ slug: regex, _id: { $ne: currentProductId } }, 'slug').lean();

  if (existingSlugs.length === 0) {
    console.log(`Generated unique slug for "${name}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  if (!existingSlugs.some(doc => doc.slug === baseSlug)) {
    console.log(`Generated unique slug for "${name}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  const numbers = existingSlugs
    .map(doc => {
      const match = doc.slug.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => !isNaN(num));

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  uniqueSlug = `${baseSlug}-${maxNumber + 1}`;

  console.log(`Generated unique slug for "${name}": ${uniqueSlug}`);
  return uniqueSlug;
};

// Hàm kiểm tra và chuẩn hóa ObjectId với log chi tiết
const validateObjectId = (id, fieldName) => {
  console.log(`Validating ${fieldName}:`, id);
  if (!id || typeof id !== 'string' || !mongoose.isValidObjectId(id)) {
    console.warn(`Invalid ${fieldName}:`, id);
    return null;
  }
  return id;
};

// Hàm kiểm tra sự tồn tại của ObjectId
const checkIdExistence = async (model, id, fieldName) => {
  const doc = await model.findById(id);
  if (!doc) {
    console.warn(`${fieldName} not found in database:`, id);
    return false;
  }
  return true;
};

// Middleware kiểm tra quyền admin
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token, quyền truy cập bị từ chối' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(403).json({ error: 'Không có quyền admin' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

// Lấy tất cả sản phẩm (bao gồm cả hidden/show, active/inactive)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate('id_category', 'status') // Lấy status của danh mục để tính isActive
      .select('-__v')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm:', err.message);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Lấy tất cả sản phẩm đang hiển thị và hoạt động (show và isActive: true)
exports.getAllActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'show' })
      .populate('id_category', 'status') // Lấy status của danh mục để tính isActive
      .select('-__v')
      .sort({ createdAt: -1 });

    // Lọc sản phẩm có isActive: true
    const activeProducts = products.filter(product => product.isActive);
    res.json(activeProducts);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm hoạt động:', err.message);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Lấy sản phẩm theo ID hoặc slug
exports.getProductByIdOrSlug = async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier (ID hoặc slug) không hợp lệ' });
    }

    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };
    const isAdmin = !!req.headers.authorization;

    let product;
    if (isAdmin) {
      // Admin: Không tăng view
      product = await Product.findOne(query)
        .populate('id_category', 'status') // Lấy status của danh mục
        .select('-__v');
    } else {
      // Non-admin: Tăng view
      product = await Product.findOneAndUpdate(
        query,
        { $inc: { view: 1 } },
        { new: true }
      )
        .populate('id_category', 'status')
        .select('-__v');
    }

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Kiểm tra nếu id_category không được populate
    if (!product.id_category) {
      console.warn(`Category not found for product ${identifier}`);
      product.isActive = false;
    }

    res.json(product);
  } catch (err) {
    console.error(`GET /api/products/${req.params.identifier} error:`, err.message);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Tạo sản phẩm
exports.createProduct = async (req, res) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size || 'undefined', filename: f.filename })) : 'No files');

    const { 
      name, status, view, id_brand, id_category, 
      short_description, description, option, active
    } = req.body;

    if (!name || !id_brand || !id_category) {
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc: name, id_brand, id_category' });
    }

    // Chuẩn hóa và kiểm tra ObjectId
    const validatedIdBrand = validateObjectId(id_brand, 'id_brand');
    const validatedIdCategory = validateObjectId(id_category, 'id_category');

    if (!validatedIdBrand || !validatedIdCategory) {
      return res.status(400).json({ error: 'id_brand hoặc id_category không hợp lệ' });
    }

    const Brand = require('../models/brand');
    const Category = require('../models/category');
    if (!(await checkIdExistence(Brand, validatedIdBrand, 'id_brand')) ||
        !(await checkIdExistence(Category, validatedIdCategory, 'id_category'))) {
      return res.status(400).json({ error: 'id_brand hoặc id_category không tồn tại' });
    }

    const slug = await generateSlug(name);
    const imagePaths = req.files && req.files.length > 0 
      ? req.files.map(file => `images/${file.filename}`)
      : [];

    let parsedOption = [];
    if (option) {
      try {
        let cleanedOption = typeof option === 'string' ? option.replace(/\n/g, '').trim() : option;
        if (cleanedOption.startsWith('{') && cleanedOption.endsWith('}')) {
          cleanedOption = `[${cleanedOption}]`;
        }
        parsedOption = JSON.parse(cleanedOption);
        if (!Array.isArray(parsedOption)) {
          parsedOption = [parsedOption];
        }
      } catch (e) {
        return res.status(400).json({ error: `Dữ liệu option không hợp lệ: ${e.message}` });
      }

      for (const opt of parsedOption) {
        if (!opt.value || typeof opt.price !== 'number' || typeof opt.stock !== 'number' || 
            opt.price < 0 || opt.stock < 0 || (opt.discount_price && opt.discount_price < 0)) {
          return res.status(400).json({ error: 'value, price, stock trong option là bắt buộc và không được âm' });
        }
      }
    }

    const product = new Product({
      name,
      slug,
      status: status || 'show',
      active: active !== undefined ? active : true,
      view: parseInt(view, 10) || 0, 
      id_brand: validatedIdBrand,
      id_category: validatedIdCategory,
      images: imagePaths,
      short_description,
      description,
      option: parsedOption
    });

    await product.save();
    res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
  } catch (err) {
    console.error('POST /api/products error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Trùng lặp slug' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size || 'undefined', filename: f.filename })) : 'No files');

    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const { name, id_brand, id_category, option, active, ...updateData } = req.body;

    // Lấy sản phẩm hiện tại
    const existingProduct = await Product.findOne(query);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Chuẩn hóa và kiểm tra ObjectId nếu có
    if (id_brand !== undefined) {
      const validatedIdBrand = validateObjectId(id_brand, 'id_brand');
      if (!validatedIdBrand) {
        return res.status(400).json({ error: `id_brand không hợp lệ: ${id_brand}` });
      }
      const Brand = require('../models/brand');
      if (!(await checkIdExistence(Brand, validatedIdBrand, 'id_brand'))) {
        return res.status(400).json({ error: `id_brand không tồn tại trong database: ${validatedIdBrand}` });
      }
      updateData.id_brand = validatedIdBrand;
    }

    if (id_category !== undefined) {
      const validatedIdCategory = validateObjectId(id_category, 'id_category');
      if (!validatedIdCategory) {
        return res.status(400).json({ error: `id_category không hợp lệ: ${id_category}` });
      }
      const Category = require('../models/category');
      if (!(await checkIdExistence(Category, validatedIdCategory, 'id_category'))) {
        return res.status(400).json({ error: `id_category không tồn tại trong database: ${validatedIdCategory}` });
      }
      updateData.id_category = validatedIdCategory;
    }

    // Tự động tạo slug mới nếu name thay đổi
    if (name && name !== existingProduct.name) {
      const newSlug = await generateSlug(name, isObjectId ? identifier : existingProduct._id);
      updateData.name = name;
      updateData.slug = newSlug;
      console.log('Generated new slug from name:', newSlug);
    }

    // Kiểm tra tính hợp lệ của option
    if (option !== undefined) {
      let parsedOption;
      try {
        let cleanedOption = typeof option === 'string' ? option.replace(/\n/g, '').trim() : option;
        if (cleanedOption.startsWith('{') && cleanedOption.endsWith('}')) {
          cleanedOption = `[${cleanedOption}]`;
        }
        parsedOption = JSON.parse(cleanedOption);
        if (!Array.isArray(parsedOption)) {
          parsedOption = [parsedOption];
        }
      } catch (e) {
        return res.status(400).json({ error: `Dữ liệu option không hợp lệ: ${e.message}` });
      }

      for (const opt of parsedOption) {
        if (!opt.value || typeof opt.price !== 'number' || typeof opt.stock !== 'number' || 
            opt.price < 0 || opt.stock < 0 || (opt.discount_price && opt.discount_price < 0)) {
          return res.status(400).json({ error: 'value, price, stock trong option là bắt buộc và không được âm' });
        }
      }
      updateData.option = parsedOption;
    }

    // Cập nhật active nếu được cung cấp
    if (active !== undefined) {
      updateData.active = active;
    }

    // Xử lý file upload
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `images/${file.filename}`);
    }

    // Loại bỏ các trường undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedProduct = await Product.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true, select: '-__v' }
    ).populate('id_category', 'status'); // Lấy status của danh mục

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ message: 'Cập nhật sản phẩm thành công', product: updatedProduct });
  } catch (err) {
    console.error(`PUT /api/products/${req.params.identifier} error:`, err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Trùng lặp slug' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const deletedProduct = await Product.findOneAndDelete(query);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (err) {
    console.error(`DELETE /api/products/${req.params.identifier} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Chuyển đổi trạng thái hiển thị sản phẩm
exports.toggleProductVisibility = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const product = await Product.findOne(query).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    product.status = product.status === 'show' ? 'hidden' : 'show';
    await product.save();

    await product.populate('id_category', 'status'); // Populate sau khi lưu để tính isActive

    res.json({
      message: `Sản phẩm đã được ${product.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      product,
    });
  } catch (err) {
    console.error(`PUT /api/products/${req.params.identifier}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Chuyển đổi trạng thái active của sản phẩm
exports.toggleProductActive = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const product = await Product.findOne(query).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    product.active = !product.active; // Chuyển đổi trạng thái active
    await product.save();

    await product.populate('id_category', 'status'); // Populate sau khi lưu để tính isActive

    res.json({
      message: `Sản phẩm đã được ${product.active ? 'kích hoạt' : 'tắt kích hoạt'}`,
      product,
    });
  } catch (err) {
    console.error(`PUT /api/products/${req.params.identifier}/toggle-active error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

module.exports = {
  getAllProducts: exports.getAllProducts,
  getAllActiveProducts: exports.getAllActiveProducts,
  getProductByIdOrSlug: exports.getProductByIdOrSlug,
  createProduct: exports.createProduct,
  updateProduct: exports.updateProduct,
  deleteProduct: exports.deleteProduct,
  toggleProductVisibility: exports.toggleProductVisibility,
  toggleProductActive: exports.toggleProductActive,
  verifyAdmin,
};