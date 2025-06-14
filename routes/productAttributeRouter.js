const express = require('express');
const router = express.Router();
const productAttributeController = require('../controllers/productAttributeController');

router.get('/', productAttributeController.getAllProductAttributes);

router.get('/:id', productAttributeController.getProductAttributeById);

router.post('/', productAttributeController.createProductAttribute);

router.put('/:id', productAttributeController.updateProductAttribute);

router.delete('/:id', productAttributeController.deleteProductAttribute);


module.exports = router;