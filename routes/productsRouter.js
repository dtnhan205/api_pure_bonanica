const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalUpload, handleMulterError } = require('../middlewares/upload');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.get('/', authMiddleware, isAdmin, productController.getAllProducts);

router.get('/active', productController.getAllActiveProducts);

router.get('/:identifier', productController.getProductByIdOrSlug);

router.post('/', authMiddleware, isAdmin, optionalUpload, handleMulterError, productController.createProduct);

router.put('/:identifier', authMiddleware, isAdmin, optionalUpload, handleMulterError, productController.updateProduct);

router.delete('/:identifier', authMiddleware, isAdmin, productController.deleteProduct);

router.put('/:identifier/toggle-visibility', authMiddleware, isAdmin, productController.toggleProductVisibility);

router.put('/:identifier/toggle-active', authMiddleware, isAdmin, productController.toggleProductActive);

module.exports = router;