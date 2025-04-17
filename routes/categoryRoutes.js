// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Create category
router.post('/', categoryController.createCategory);

// Get all categories
router.get('/', categoryController.getAllCategories);

// Get single category by ID
router.get('/:_id', categoryController.getCategoryById);

// Update category by ID
router.put('/:id', categoryController.updateCategory);

// Delete category by ID
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;