const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Category = require('../models/category');

// Create category
router.post('/', async (req, res) => {
  try {
    const category = new Category({
      name: req.body.name,
      description: req.body.description
    });
    await category.save();
    res.status(201).json({
      message: 'Tạo danh mục thành công',
      category: category
    });
  } catch (error) {
    console.error('POST /api/categories error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get all categories
router.get('/', async (req, res) => {
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
});

// Get single category by id
router.get('/:_id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
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
});

// Update category by id
router.put('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: req.body.name,
        description: req.body.description
      },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục để cập nhật' });
    }

    res.json({
      message: 'Cập nhật danh mục thành công',
      category: updatedCategory
    });
  } catch (error) {
    console.error(`PUT /api/categories/${id} error:`, error);
    res.status(400).json({ message: error.message });
  }
});

// Delete category by id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  try {
    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục để xóa' });
    }

    res.json({ message: 'Xóa danh mục thành công' });
  } catch (error) {
    console.error(`DELETE /api/categories/${id} error:`, error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

module.exports = router;