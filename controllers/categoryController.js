const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');
const Brand = require('../models/brand');

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

// Toggle Category visibility
const toggleCategoryVisibility = async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }

    // Nếu đang muốn ẨN danh mục
    if (category.status === 'show') {
      const products = await Product.find({ id_category: id });
      if (products.length > 0) {
        // Kiểm tra tổng stock của tất cả sản phẩm
        const hasStock = products.some(product =>
          Array.isArray(product.option) && product.option.some(opt => opt.stock > 0)
        );
        if (hasStock) {
          return res.status(400).json({
            message: 'Không thể ẩn danh mục vì vẫn còn sản phẩm có tồn kho!'
          });
        }
      }
    }

    // Chuyển trạng thái
    const newStatus = category.status === 'show' ? 'hidden' : 'show';
    category.status = newStatus;
    await category.save();

    // Cập nhật active cho sản phẩm liên quan
    const products = await Product.find({ id_category: id });
    for (const product of products) {
      if (newStatus === 'hidden') {
        // Nếu danh mục ẩn, đặt sản phẩm thành false
        await Product.findByIdAndUpdate(product._id, { $set: { active: false } });
      } else if (newStatus === 'show' && product.id_brand) {
        // Nếu danh mục show, kiểm tra trạng thái Brand
        const brand = await Brand.findById(product.id_brand);
        if (brand && brand.status === 'show') {
          await Product.findByIdAndUpdate(product._id, { $set: { active: true } });
        } else {
          await Product.findByIdAndUpdate(product._id, { $set: { active: false } });
        }
      }
    }

    res.json({
      message: `Danh mục đã được ${newStatus === 'show' ? 'hiển thị' : 'ẩn'}`,
      category,
    });
  } catch (err) {
    console.error(`PUT /api/categories/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get products by category ID
const getProductsByCategory = async (req, res) => {
  const { id_category } = req.query;
  if (!id_category || !mongoose.Types.ObjectId.isValid(id_category)) {
    console.warn(`Invalid or missing category ID: ${id_category}`);
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }
  try {
    const products = await Product.find({ id_category });
    console.log(`Products found for category ${id_category}:`, products); // Debug
    res.json(products); // Always return array, even if empty
  } catch (error) {
    console.error(`GET /api/products?id_category=${id_category} error:`, error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
  getProductsByCategory,
};