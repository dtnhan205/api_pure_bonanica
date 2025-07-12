const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


// Admin routes (đặt trước để tránh conflict)
router.get('/admin/all', authMiddleware,isAdmin,orderController.getAllOrders);
router.get('/admin/user/:userId',authMiddleware,isAdmin, orderController.getOrdersByUserIdForAdmin);
router.get('/admin/order/:orderId',authMiddleware,isAdmin, orderController.getOrderByIdForAdmin);

// User routes với prefix rõ ràng
router.get('/user/:userId',authMiddleware, orderController.getUserOrders);
router.get('/order/:orderId',authMiddleware, orderController.getOrderById);

// Status và cancel routes
router.put('/status/:orderId',authMiddleware,isAdmin, orderController.updateOrderStatus);
router.put('/update/:orderId',authMiddleware,isAdmin, orderController.updateOrder);
router.delete('/cancel/:orderId',authMiddleware,isAdmin, orderController.cancelOrder);

module.exports = router;