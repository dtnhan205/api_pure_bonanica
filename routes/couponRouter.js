const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.post('/', authMiddleware, isAdmin, couponController.createCoupon);
router.post('/bulk', authMiddleware, isAdmin, couponController.createBulkCoupons);
router.post('/auto-setup', authMiddleware, isAdmin, couponController.setupAutoCoupons);

router.put('/:id', authMiddleware, isAdmin, couponController.updateCoupon);
router.delete('/:id', authMiddleware, isAdmin, couponController.deleteCoupon);

router.get('/', authMiddleware, couponController.getCoupons);
router.get("/auto-setup", authMiddleware, isAdmin, couponController.getAutoSetupConfig);
router.get('/:id', authMiddleware, couponController.getCouponById);

module.exports = router;