const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, couponController.createCoupon);
router.post('/single', authMiddleware, isAdmin, couponController.createSingleCoupon);
router.post('/bulk', authMiddleware, isAdmin, couponController.createBulkCoupons);
router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon);
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon);
router.get('/', authMiddleware, couponController.getCoupons);
router.get('/:id', authMiddleware, couponController.getCouponById);
router.post('/check/:code', authMiddleware, couponController.checkCoupon);

module.exports = router;