const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


// Middleware log request
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Route để tạo thanh toán mới
router.post('/create',authMiddleware, async (req, res, next) => {
  try {
    await PaymentController.createPayment(req, res);
  } catch (error) {
    next(error);
  }
});

// Route để kiểm tra và verify thanh toán
router.post('/check-payment',authMiddleware, async (req, res, next) => {
  try {
    await PaymentController.checkPaymentStatus(req, res);
  } catch (error) {
    next(error);
  }
});

// Route để lấy thông tin thanh toán theo userId
router.post('/get-by-user',authMiddleware, async (req, res, next) => {
  try {
    await PaymentController.getPaymentsByUserId(req, res);
  } catch (error) {
    next(error);
  }
});
// Route mới để lấy thông tin thanh toán (tên người bank, thời gian, số tiền, paymentCode, nội dung)
router.post('/get-payments', authMiddleware, isAdmin, async (req, res, next) => {
  try {
    await PaymentController.getPayments(req, res);
  } catch (error) {
    next(error);
  }
});

// Middleware xử lý lỗi toàn cục
router.use((error, req, res, next) => {
  console.error(`Lỗi router: ${error.message}`, error.stack);
  res.status(500).json({
    status: 'error',
    message: error.message || 'Lỗi server. Vui lòng thử lại sau',
  });
});

module.exports = router;