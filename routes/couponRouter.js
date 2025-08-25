const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, couponController.createCoupon); // Tạo mã giảm giá
router.post('/bulk', authMiddleware, isAdmin, couponController.createBulkCoupons); // Tạo mã hàng loạt
router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon); // Cập nhật mã giảm giá
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon); // Xóa mã giảm giá
router.get('/', authMiddleware, couponController.getCoupons); // Lấy tất cả mã giảm giá
router.get('/:id', authMiddleware, couponController.getCouponById); // Lấy chi tiết mã giảm giá
router.post('/auto-setup', authMiddleware, isAdmin, couponController.setupAutoCoupons); // Thiết lập tự động tạo mã
router.get("/auto-setup", authMiddleware, isAdmin, couponController.getAutoSetupConfig);

module.exports = router;