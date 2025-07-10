const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


// Admin routes (đặt trước để tránh conflict)
router.get('/admin/all', orderController.getAllOrders);
router.get('/admin/user/:userId', orderController.getOrdersByUserIdForAdmin);
router.get('/admin/order/:orderId', orderController.getOrderByIdForAdmin);

// User routes với prefix rõ ràng
router.get('/user/:userId', orderController.getUserOrders);
router.get('/order/:orderId', orderController.getOrderById);

// Status và cancel routes
router.put('/status/:orderId', orderController.updateOrderStatus);
router.put('/update/:orderId', orderController.updateOrder);
router.delete('/cancel/:orderId', orderController.cancelOrder);

module.exports = router;