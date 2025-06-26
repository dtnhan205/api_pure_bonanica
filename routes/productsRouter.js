const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalUpload, handleMulterError } = require('../middlewares/upload');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, optionalUpload, handleMulterError, productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/:slug', productController.getProductBySlug);
router.put('/:id', authMiddleware, isAdmin, optionalUpload, handleMulterError, productController.updateProduct);
router.delete('/:slug', authMiddleware, isAdmin, productController.deleteProduct);
router.put('/:id/toggle-visibility', authMiddleware, isAdmin, productController.toggleProductVisibility);

module.exports = router;