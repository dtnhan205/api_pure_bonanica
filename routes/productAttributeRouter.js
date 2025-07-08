const express = require('express');
const router = express.Router();
const productAttributeController = require('../controllers/productAttributeController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.get('/', productAttributeController.getAllProductAttributes);

router.get('/:id', productAttributeController.getProductAttributeById);

router.post('/',authMiddleware,isAdmin, productAttributeController.createProductAttribute);

router.put('/:id',authMiddleware,isAdmin, productAttributeController.updateProductAttribute);

router.delete('/:id',authMiddleware,isAdmin, productAttributeController.deleteProductAttribute);


module.exports = router;