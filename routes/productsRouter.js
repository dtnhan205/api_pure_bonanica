const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalUpload, handleMulterError } = require('../middlewares/upload');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.get('/', productController.getAllProducts);

router.get('/active', productController.getAllActiveProducts);

router.get('/:identifier', productController.getProductByIdOrSlug);

router.post('/', optionalUpload, handleMulterError, productController.createProduct);

router.put('/:identifier', optionalUpload, handleMulterError, productController.updateProduct);

router.delete('/:identifier', productController.deleteProduct);

router.put('/:identifier/toggle-visibility', productController.toggleProductVisibility);

router.put('/:identifier/toggle-active', productController.toggleProductActive);

module.exports = router;