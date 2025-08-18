const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, couponController.createCoupon);
router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon);
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon);
router.get('/', authMiddleware, couponController.getCoupons);
router.get('/:id', authMiddleware, couponController.getCouponById);
router.get('/check/:code', authMiddleware, couponController.checkCoupon);
router.post('/birthday', authMiddleware, isAdmin, couponController.createBirthdayCoupon);

module.exports = router;