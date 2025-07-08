const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');

// Create category
const createCategory = async (req, res) => {
  try {
    const category = new Category({
      name: req.body.name,
    });
    await category.save();
    res.status(201).json({
      message: 'Tạo danh mục thành công',
      category,
    });
  } catch (error) {
    console.error('POST /api/categories error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    if (!categories.length) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục nào' });
    }
    res.json(categories);
  } catch (error) {
    console.error('GET /api/categories error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// Get single category by ID
const getCategoryById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid category ID: ${id}`);
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }
  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }
    res.json(category);
  } catch (error) {
    console.error(`GET /api/categories/${id} error:`, error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// Update category by ID
const updateCategory = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid category ID: ${id}`);
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }
  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: req.body.name },
      { new: true, runValidators: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục để cập nhật' });
    }
    res.json({
      message: 'Cập nhật danh mục thành công',
      category: updatedCategory,
    });
  } catch (error) {
    console.error(`PUT /api/categories/${id} error:`, error);
    res.status(400).json({ message: error.message });
  }
};

// Delete category by ID
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid category ID: ${id}`);
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }
  try {
    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục để xóa' });
    }
    // Cập nhật các sản phẩm liên quan khi xóa danh mục
    await Product.updateMany(
      { id_category: id },
      { $set: { active: false } }
    );
    res.json({ message: 'Xóa danh mục thành công' });
  } catch (error) {
    console.error(`DELETE /api/categories/${id} error:`, error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// Toggle Category visibility (Chuyển đổi giữa hidden và show)
const toggleCategoryVisibility = async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`Invalid or missing category ID: ${id}`);
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }

    const newStatus = category.status === 'show' ? 'hidden' : 'show';
    category.status = newStatus;
    await category.save();

    // Cập nhật trường active của các sản phẩm liên quan
    const updateValue = newStatus === 'hidden' ? false : true;
    await Product.updateMany(
      { id_category: id },
      { $set: { active: updateValue } }
    );

    res.json({
      message: `Danh mục đã được ${newStatus === 'show' ? 'hiển thị' : 'ẩn'}`,
      category,
    });
  } catch (err) {
    console.error(`PUT /api/categories/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
};