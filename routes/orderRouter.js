const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/all', orderController.getAllOrders);
router.get('/admin/user/:userId', orderController.getOrdersByUserIdForAdmin); 
router.get('/admin/:orderId', orderController.getOrderByIdForAdmin);
router.get('/', orderController.getUserOrders);
router.get('/:orderId', orderController.getOrderById); 
router.put('/status/:orderId', orderController.updateOrderStatus);
router.delete('/cancel/:orderId', orderController.cancelOrder);

module.exports = router;