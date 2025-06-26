const Product = require('../models/product');
const mongoose = require('mongoose');

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
  const existingSlugs = await Product.find({ slug: regex }, 'slug').lean();

  if (existingSlugs.length === 0) {
    console.log(`Generated unique slug for "${name}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  // Lấy danh sách các số từ các slug hiện có (nếu có)
  const numbers = existingSlugs
    .map(doc => {
      const match = doc.slug.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => !isNaN(num));

  // Nếu không có slug nào trùng hoặc chỉ có baseSlug mà không có số, trả về baseSlug
  if (!existingSlugs.some(doc => doc.slug === baseSlug)) {
    console.log(`Generated unique slug for "${name}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  // Tìm số lớn nhất và tăng thêm 1
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

// Hàm kiểm tra sự tồn tại của ObjectId (tùy chọn)
const checkIdExistence = async (model, id, fieldName) => {
  const doc = await model.findById(id);
  if (!doc) {
    console.warn(`${fieldName} not found in database:`, id);
    return false;
  }
  return true;
};

exports.createProduct = async (req, res, next) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size || 'undefined', filename: f.filename })) : 'No files');

    const { 
      name, status, view, id_brand, id_category, 
      short_description, description, option 
    } = req.body;

    if (!name || !id_brand || !id_category) {
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc: name, id_brand, id_category' });
    }

    // Chuẩn hóa và kiểm tra ObjectId
    const validatedIdBrand = validateObjectId(id_brand, 'id_brand');
    const validatedIdCategory = validateObjectId(id_category, 'id_category');

    console.log('Validated id_brand:', validatedIdBrand);
    console.log('Validated id_category:', validatedIdCategory);

    // Kiểm tra tính hợp lệ của ObjectId
    if (!validatedIdBrand) {
      return res.status(400).json({ error: `id_brand không hợp lệ: ${id_brand}` });
    }
    if (!validatedIdCategory) {
      return res.status(400).json({ error: `id_category không hợp lệ: ${id_category}` });
    }

    // Tùy chọn: Kiểm tra sự tồn tại trong database
    const Category = require('../models/category');
    if (!(await checkIdExistence(Category, validatedIdCategory, 'id_category'))) {
      return res.status(400).json({ error: `id_category không tồn tại trong database: ${validatedIdCategory}` });
    }

    // Tạo slug tự động từ name
    const slug = await generateSlug(name);

    // Kiểm tra tính hợp lệ của option
    let parsedOption = [];
    if (option) {
      try {
        let cleanedOption = typeof option === 'string' ? option.replace(/\n/g, '').trim() : option;
        if (cleanedOption.startsWith('{') && cleanedOption.endsWith('}')) {
          cleanedOption = `[${cleanedOption}]`; // Chuyển thành mảng nếu là object đơn
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

    // Xử lý file upload
    const imagePaths = req.files && req.files.length > 0 
      ? req.files.map(file => `/images/${file.filename}`)
      : [];

    const product = new Product({
      name,
      slug,
      status: status || 'show',
      view: view || 0,
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
    console.error('Lỗi tạo sản phẩm:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'show' }).select('-__v').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.getProductBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const product = await Product.findOne({ slug, status: 'show' }).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json(product);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm theo slug:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    console.log('Received body for update:', JSON.stringify(req.body, null, 2));
    console.log('Received files for update:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size || 'undefined', filename: f.filename })) : 'No files');

    const { id } = req.params; // Sử dụng id thay vì slug
    const { name, id_brand, id_category, option, ...updateData } = req.body;

    // Kiểm tra tính hợp lệ của id
    const validatedId = validateObjectId(id, '_id');
    if (!validatedId) {
      return res.status(400).json({ error: `ID sản phẩm không hợp lệ: ${id}` });
    }

    // Lấy sản phẩm hiện tại để so sánh
    const existingProduct = await Product.findById(validatedId).select('name slug');
    if (!existingProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Chuẩn hóa và kiểm tra ObjectId nếu có trong updateData
    let validatedIdBrand = updateData.id_brand; // Giá trị mặc định từ database nếu không thay đổi
    if (id_brand !== undefined) { // Chỉ kiểm tra nếu id_brand được gửi
      validatedIdBrand = validateObjectId(id_brand, 'id_brand');
      if (!validatedIdBrand) {
        return res.status(400).json({ error: `id_brand không hợp lệ: ${id_brand}` });
      }
      updateData.id_brand = validatedIdBrand;
    }

    let validatedIdCategory = updateData.id_category; // Giá trị mặc định từ database nếu không thay đổi
    if (id_category !== undefined) { // Chỉ kiểm tra nếu id_category được gửi
      validatedIdCategory = validateObjectId(id_category, 'id_category');
      if (!validatedIdCategory) {
        return res.status(400).json({ error: `id_category không hợp lệ: ${id_category}` });
      }
      updateData.id_category = validatedIdCategory;
    }

    // Log để debug
    console.log('Validated id_brand:', validatedIdBrand);
    console.log('Validated id_category:', validatedIdCategory);

    // Tùy chọn: Kiểm tra sự tồn tại trong database nếu có thay đổi
    if (id_category !== undefined) {
      const Category = require('../models/category');
      if (!(await checkIdExistence(Category, validatedIdCategory, 'id_category'))) {
        return res.status(400).json({ error: `id_category không tồn tại trong database: ${validatedIdCategory}` });
      }
    }
    if (id_brand !== undefined) {
      const Brand = require('../models/brand');
      if (!(await checkIdExistence(Brand, validatedIdBrand, 'id_brand'))) {
        return res.status(400).json({ error: `id_brand không tồn tại trong database: ${validatedIdBrand}` });
      }
    }

    // Tự động tạo slug mới và cập nhật name nếu name được gửi
    if (name && name !== existingProduct.name) {
      const newSlug = await generateSlug(name, existingProduct._id); // Loại trừ sản phẩm hiện tại
      updateData.name = name; // Cập nhật tên sản phẩm
      updateData.slug = newSlug; // Cập nhật slug
      console.log('Generated new slug from name:', newSlug);
    }

    // Kiểm tra tính hợp lệ của option
    if (option !== undefined) { // Chỉ kiểm tra nếu option được gửi
      let parsedOption;
      try {
        let cleanedOption = typeof option === 'string' ? option.replace(/\n/g, '').trim() : option;
        if (cleanedOption.startsWith('{') && cleanedOption.endsWith('}')) {
          cleanedOption = `[${cleanedOption}]`; // Chuyển thành mảng nếu là object đơn
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

    // Xử lý file upload
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `/images/${file.filename}`);
    }

    // Thêm log trước khi cập nhật
    console.log('Update data:', JSON.stringify(updateData, null, 2));

    const updatedProduct = await Product.findByIdAndUpdate(
      validatedId, // Sử dụng _id để tìm chính xác sản phẩm
      { $set: updateData },
      { new: true, runValidators: true, select: '-__v' }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ message: 'Cập nhật thành công', product: updatedProduct });
  } catch (err) {
    console.error('Lỗi cập nhật sản phẩm:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const deletedProduct = await Product.findOneAndDelete({ slug });
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (err) {
    console.error('Lỗi xóa sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.toggleProductVisibility = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const product = await Product.findOne({ slug }).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    product.status = product.status === 'show' ? 'hidden' : 'show';
    await product.save();

    res.json({ message: `Trạng thái sản phẩm đã chuyển thành ${product.status}`, product });
  } catch (err) {
    console.error('Lỗi toggle visibility:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};