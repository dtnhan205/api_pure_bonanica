const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', categoryController.createCategory);

router.get('/', categoryController.getAllCategories);

router.get('/:_id', categoryController.getCategoryById);

router.put('/:id', categoryController.updateCategory);

router.delete('/:id', categoryController.deleteCategory);

router.put('/:id/toggle-visibility', categoryController.toggleCategoryVisibility);

router.get('/products', categoryController.getProductsByCategory);

module.exports = router;