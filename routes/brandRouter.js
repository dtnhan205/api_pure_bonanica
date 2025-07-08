const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.get('/', brandController.getAllBrands);
router.get('/:id', brandController.getBrandById);
router.post('/',authMiddleware,isAdmin, brandController.createBrand);
router.put('/:id',authMiddleware,isAdmin, brandController.updateBrand);
router.delete('/:id',authMiddleware,isAdmin, brandController.deleteBrand);
router.put('/:id/toggle-visibility',authMiddleware,isAdmin, brandController.toggleBrandVisibility);

module.exports = router;