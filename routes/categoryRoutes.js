const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

// Create category - Chỉ admin
router.post('/', authMiddleware, isAdmin, categoryController.createCategory);

// Get all categories - Công khai
router.get('/', categoryController.getAllCategories);

// Get single category by ID - Công khai
router.get('/:_id', categoryController.getCategoryById);

// Update category by ID - Chỉ admin
router.put('/:id', authMiddleware, isAdmin, categoryController.updateCategory);

// Delete category by ID - Chỉ admin
router.delete('/:id', authMiddleware, isAdmin, categoryController.deleteCategory);

// Chuyển đổi trạng thái hiển thị danh mục - Chỉ admin
router.put('/:id/toggle-visibility', authMiddleware, isAdmin, categoryController.toggleCategoryVisibility);

module.exports = router;