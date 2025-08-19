const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, couponController.createCoupon); // Tạo mã giảm giá
router.post('/single', authMiddleware, isAdmin, couponController.createSingleCoupon); // Tạo mã cho một người dùng
router.post('/bulk', authMiddleware, isAdmin, couponController.createBulkCoupons); // Tạo mã hàng loạt
router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon); // Cập nhật mã giảm giá
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon); // Xóa mã giảm giá
router.get('/', authMiddleware, couponController.getCoupons); // Lấy danh sách mã giảm giá
router.get('/:id', authMiddleware, couponController.getCouponById); // Lấy chi tiết mã giảm giá
router.post('/check/:code', authMiddleware, couponController.checkCoupon); // Kiểm tra mã giảm giá
router.get('/user/:userId', authMiddleware, couponController.getCouponsByUserId); // Lấy mã giảm giá theo userId

module.exports = router;