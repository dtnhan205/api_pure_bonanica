const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { upload, handleMulterError } = require('../middlewares/upload');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

// Lấy tất cả brand (show)
router.get('/', brandController.getAllBrands);

// Lấy brand theo ID
router.get('/:id', brandController.getBrandById);

// Tạo brand mới
router.post('/', upload.single('logoImg'), handleMulterError, brandController.createBrand);

// Cập nhật brand
router.put('/:id',upload.single('logoImg'), handleMulterError, brandController.updateBrand);

// Xóa brand
router.delete('/:id', brandController.deleteBrand);

// Chuyển đổi trạng thái hiển thị
router.put('/:id/toggle-visibility',  brandController.toggleBrandVisibility);

module.exports = router;