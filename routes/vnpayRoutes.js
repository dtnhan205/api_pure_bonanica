const express = require('express');
const router = express.Router();
const VnpayController = require('../controllers/vnpayController');

router.post('/create-payment', VnpayController.createPayment);
router.post('/verify-payment', VnpayController.verifyPayment);
router.post('/check-payment-status', VnpayController.checkPaymentStatus);
router.get('/vnpay-return', VnpayController.handleVnpayReturn);

module.exports = router;