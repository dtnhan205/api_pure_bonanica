const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalUpload, handleMulterError } = require('../middlewares/upload');

router.post('/', optionalUpload, handleMulterError, productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/:slug', productController.getProductBySlug);
router.put('/:slug', optionalUpload, handleMulterError, productController.updateProduct);
router.delete('/:slug', productController.deleteProduct);
router.put('/:slug/toggle-visibility', productController.toggleProductVisibility);

module.exports = router;