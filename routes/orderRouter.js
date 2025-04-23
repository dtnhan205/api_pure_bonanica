const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/all', orderController.getAllOrders); // Lấy tất cả đơn hàng (admin)
router.get('/admin/user/:userId', orderController.getOrdersByUserIdForAdmin); // Lấy đơn hàng theo userId (admin)
router.get('/admin/:orderId', orderController.getOrderByIdForAdmin); // Lấy chi tiết đơn hàng theo orderId (admin)
router.get('/', orderController.getUserOrders); // Lấy danh sách đơn hàng của người dùng
router.get('/:orderId', orderController.getOrderById); // Lấy chi tiết đơn hàng (user)
router.put('/status/:orderId', orderController.updateOrderStatus); // Cập nhật trạng thái đơn hàng
router.delete('/cancel/:orderId', orderController.cancelOrder); // Hủy đơn hàng

module.exports = router;