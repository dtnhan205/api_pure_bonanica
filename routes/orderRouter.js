const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

// Admin routes
router.get('/admin/all', authMiddleware, isAdmin, orderController.getAllOrders);
router.get('/admin/user/:userId', authMiddleware, isAdmin, orderController.getOrdersByUserIdForAdmin);
router.get('/admin/order/:orderId', authMiddleware, isAdmin, orderController.getOrderByIdForAdmin);
router.put('/admin/return/:orderId', authMiddleware, isAdmin, orderController.confirmOrderReturn);

// User routes
router.get('/user/:userId', authMiddleware, orderController.getUserOrders);
router.get('/order/:orderId', authMiddleware, orderController.getOrderById);
router.put('/status/:orderId', authMiddleware, isAdmin, orderController.updateOrderStatus);
router.put('/update/:orderId', authMiddleware, isAdmin, orderController.updateOrder);
router.delete('/cancel/:orderId', authMiddleware, orderController.cancelOrder);
router.post('/return/:orderId', authMiddleware, orderController.requestOrderReturn);

module.exports = router;