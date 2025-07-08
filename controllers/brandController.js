const mongoose = require('mongoose');
const Brand = require('../models/brand');

// Get all brands (chỉ lấy brand có status: 'show')
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ status: 'show' });
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
    const brand = await Brand.findOne({ _id: IDBFactory });
    if (!brand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu' });
    }
    res.json(brand);
  } catch (err) {
    console.error(`GET /api/brands/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Create a new brand
exports.createBrand = async (req, res) => {
  try {
    const { name, status } = req.body;

    const newBrand = new Brand({
      _id: req.body._id || new mongoose.Types.ObjectId(),
      name,
      status: status || 'show',
    });

    await newBrand.save();
    res.status(201).json({
      message: 'Tạo thương hiệu thành công',
      brand: newBrand,
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
    const { name, status } = req.body;

    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      { name, status },
      { new: true, runValidators: true }
    );

    if (!updatedBrand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu để cập nhật' });
    }

    res.json({
      message: 'Cập nhật thương hiệu thành công',
      brand: updatedBrand,
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

// Toggle brand visibility (Chuyển đổi giữa hidden và show)
exports.toggleBrandVisibility = async (req, res) => {
  const { id } = req.params;

  try {
    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ message: 'Không tìm thấy thương hiệu' });
    }

    brand.status = brand.status === 'show' ? 'hidden' : 'show';
    await brand.save();

    res.json({
      message: `Thương hiệu đã được ${brand.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      brand,
    });
  } catch (err) {
    console.error(`PUT /api/brands/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};