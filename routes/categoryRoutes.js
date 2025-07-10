const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, categoryController.createCategory);

router.get('/', categoryController.getAllCategories);

router.get('/:_id', categoryController.getCategoryById);

router.put('/:id', authMiddleware, isAdmin, categoryController.updateCategory);

router.delete('/:id', authMiddleware, isAdmin, categoryController.deleteCategory);

router.put('/:id/toggle-visibility', authMiddleware, isAdmin, categoryController.toggleCategoryVisibility);

router.get('/products', authMiddleware, isAdmin, categoryController.getProductsByCategory);

module.exports = router;