const mongoose = require('mongoose');
const Brand = require('../models/brand');

// Get all brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ status: 'show' }).select('-__v');
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
      logoImg: `images/${req.file.path}`
    });

    await newBrand.save();
    res.status(201).json({
      message: 'Tạo thương hiệu thành công',
      brand: newBrand
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

  try {
    console.log('Received body:', req.body);
    console.log('Received file:', req.file);

    const { name, status } = req.body;
    const updateData = { name, status };

    if (req.file) {
      updateData.logoImg = `images/${req.file.path}`;
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, select: '-__v' }
    );

    if (!updatedBrand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu để cập終わ nhật' });
    }

    res.json({
      message: 'Cập nhật thương hiệu thành công',
      brand: updatedBrand
    });
  } catch (err) {
    console.error(`PUT /api/brands/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
};

// Delete a brand by ID
exports.deleteBrand = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedBrand = await Brand.findByIdAndDelete(id);
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu để xóa' });
    }
    res.json({ message: 'Xóa thương hiệu thành công' });
  } catch (err) {
    console.error(`DELETE /api/brands/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Toggle brand visibility
exports.toggleBrandVisibility = async (req, res) => {
  const { id } = req.params;

  try {
    const brand = await Brand.findById(id).select('-__v');
    if (!brand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu' });
    }

    brand.status = brand.status === 'show' ? 'hidden' : 'show';
    await brand.save();

    res.json({
      message: `Thương hiệu đã được ${brand.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      brand
    });
  } catch (err) {
    console.error(`PUT /api/brands/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};