const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');

router.post('/create', PaymentController.createPayment);
router.get('/status/:paymentCode', PaymentController.checkPaymentStatus);

module.exports = router;