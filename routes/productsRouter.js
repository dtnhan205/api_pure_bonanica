const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../middlewares/upload');

router.post('/', upload.array('images', 4), productController.createProduct);
router.put('/:id', upload.array('images', 4), productController.updateProduct);
router.get('/no-discount', productController.getProductsWithoutDiscount);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.delete('/:id', productController.deleteProduct);
router.put('/:id/toggle-visibility', productController.toggleProductVisibility); 

module.exports = router;