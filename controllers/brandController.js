const mongoose = require('mongoose');
const Brand = require('../models/brand');
const Product = require('../models/product');
const Category = require('../models/category');

// Get all brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find().select('-__v');
    if (!brands.length) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu nào' });
    }
    res.json(brands);
  } catch (err) {
    console.error('GET /api/brands error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get brand by ID
exports.getBrandById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid brand ID: ${id}`);
    return res.status(400).json({ message: 'ID thương hiệu không hợp lệ' });
  }
  try {
    const brand = await Brand.findById(id).select('-__v');
    if (!brand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu' });
    }
    res.json(brand);
  } catch (err) {
    console.error(`GET /api/brands/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Create a new brand with image upload
exports.createBrand = async (req, res) => {
  try {
    console.log('Received body:', req.body);
    console.log('Received file:', req.file);

    if (!req.body) {
      return res.status(400).json({ error: 'Dữ liệu request body không hợp lệ' });
    }

    const { name, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tên thương hiệu là bắt buộc' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload hình ảnh logo' });
    }

    const newBrand = new Brand({
      _id: new mongoose.Types.ObjectId(),
      name,
      status: status || 'show',
      logoImg: `${req.file.path}`
    });

    await newBrand.save();

    // Nếu trạng thái là hidden, đặt active: false cho sản phẩm liên quan
    if (newBrand.status === 'hidden') {
      const products = await Product.find({ id_brand: newBrand._id });
      let warning = null;
      if (products.length > 0) {
        const hasStock = products.some(product =>
          Array.isArray(product.option) && product.option.some(opt => opt.stock > 0)
        );
        if (hasStock) {
          warning = 'Cảnh báo: Thương hiệu được ẩn mặc dù vẫn còn sản phẩm có tồn kho!';
        }
        await Product.updateMany(
          { id_brand: newBrand._id },
          { $set: { active: false } }
        );
      }
    }

    res.status(201).json({
      message: 'Tạo thương hiệu thành công',
      brand: newBrand,
      warning
    });
  } catch (err) {
    console.error('POST /api/brands error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Tên thương hiệu đã tồn tại' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Update a brand by ID
exports.updateBrand = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid brand ID: ${id}`);
    return res.status(400).json({ message: 'ID thương hiệu không hợp lệ' });
  }
  try {
    console.log('Received body:', req.body);
    console.log('Received file:', req.file);

    const { name, status } = req.body;
    const updateData = { name, status };

    if (req.file) {
      updateData.logoImg = `${req.file.path}`;
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, select: '-__v' }
    );

    if (!updatedBrand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu để cập nhật' });
    }

    // Kiểm tra trạng thái và cập nhật sản phẩm liên quan
    let warning = null;
    if (updatedBrand.status === 'hidden') {
      const products = await Product.find({ id_brand: id });
      if (products.length > 0) {
        const hasStock = products.some(product =>
          Array.isArray(product.option) && product.option.some(opt => opt.stock > 0)
        );
        if (hasStock) {
          warning = 'Cảnh báo: Thương hiệu được ẩn mặc dù vẫn còn sản phẩm có tồn kho!';
        }
        await Product.updateMany(
          { id_brand: id },
          { $set: { active: false } }
        );
      }
    } else if (updatedBrand.status === 'show') {
      const products = await Product.find({ id_brand: id });
      for (const product of products) {
        if (product.id_category) {
          const category = await Category.findById(product.id_category);
          if (category && category.status === 'show') {
            await Product.findByIdAndUpdate(product._id, { $set: { active: true } });
          } else {
            await Product.findByIdAndUpdate(product._id, { $set: { active: false } });
          }
        }
      }
    }

    res.json({
      message: 'Cập nhật thương hiệu thành công',
      brand: updatedBrand,
      warning
    });
  } catch (err) {
    console.error(`PUT /api/brands/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
};

// Delete a brand by ID
exports.deleteBrand = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid brand ID: ${id}`);
    return res.status(400).json({ message: 'ID thương hiệu không hợp lệ' });
  }
  try {
    const deletedBrand = await Brand.findByIdAndDelete(id);
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu để xóa' });
    }
    // Cập nhật các sản phẩm liên quan khi xóa thương hiệu
    await Product.updateMany(
      { id_brand: id },
      { $set: { active: false } }
    );
    res.json({ message: 'Xóa thương hiệu thành công' });
  } catch (err) {
    console.error(`DELETE /api/brands/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Toggle brand visibility
exports.toggleBrandVisibility = async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid brand ID: ${id}`);
    return res.status(400).json({ message: 'ID thương hiệu không hợp lệ' });
  }

  try {
    const brand = await Brand.findById(id).select('-__v');
    if (!brand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu' });
    }

    // Nhận trạng thái mới từ body
    const { status } = req.body;
    if (!status || !['show', 'hidden'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ, phải là "show" hoặc "hidden"' });
    }

    // Nếu chuyển sang hidden
    if (status === 'hidden' && brand.status !== 'hidden') {
      const products = await Product.find({ id_brand: id });
      let warning = null;
      if (products.length > 0) {
        const hasStock = products.some(product =>
          Array.isArray(product.option) && product.option.some(opt => opt.stock > 0)
        );
        if (hasStock) {
          warning = 'Cảnh báo: Thương hiệu được ẩn mặc dù vẫn còn sản phẩm có tồn kho!';
        }

        // Cập nhật active: false cho sản phẩm liên quan
        await Product.updateMany(
          { id_brand: id },
          { $set: { active: false } }
        );
      }
      brand.status = status;
      await brand.save();

      res.json({
        message: `Thương hiệu đã được đặt trạng thái ${status === 'show' ? 'hiển thị' : 'ẩn'}`,
        brand,
        warning
      });
      return;
    }

    // Nếu chuyển sang show
    if (status === 'show' && brand.status !== 'show') {
      const products = await Product.find({ id_brand: id });
      for (const product of products) {
        if (product.id_category) {
          const category = await Category.findById(product.id_category);
          if (category && category.status === 'show') {
            await Product.findByIdAndUpdate(product._id, { $set: { active: true } });
          } else {
            await Product.findByIdAndUpdate(product._id, { $set: { active: false } });
          }
        }
      }
      brand.status = status;
      await brand.save();

      res.json({
        message: `Thương hiệu đã được đặt trạng thái ${status === 'show' ? 'hiển thị' : 'ẩn'}`,
        brand
      });
    }
  } catch (err) {
    console.error(`PUT /api/brands/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};