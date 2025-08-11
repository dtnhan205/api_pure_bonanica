const Order = require('../models/order');
const Users = require('../models/user');
const mongoose = require('mongoose');

// Admin functions
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .populate('user', 'username email')
      .sort({ _id: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy tất cả đơn hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy tất cả đơn hàng', details: error.message });
  }
};

exports.getOrdersByUserIdForAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong URL' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .populate('user', 'username email')
      .sort({ _id: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng theo userId (admin):', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng theo userId (admin)', details: error.message });
  }
};

exports.getOrderByIdForAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'Thiếu orderId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('user', 'username email');

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng (admin):', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết đơn hàng (admin)', details: error.message });
  }
};

// User functions
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ _id: -1 })
      .lean();

    res.status(200).json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng', details: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'Thiếu orderId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('user', 'username email');

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết đơn hàng', details: error.message });
  }
};

exports.getOrderByIdWithAuth = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'userId hoặc orderId không hợp lệ' });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).populate({
      path: 'items.product',
      select: 'name price image'
    });

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error);
    res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (!['pending', 'completed', 'failed', 'cancelled'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ' });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    await order.populate('items.product');
    res.json({ message: 'Cập nhật trạng thái thanh toán thành công', order });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái thanh toán:', error.message);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái thanh toán', details: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancelReason, cancelNote } = req.body;

    // Validate orderId
    if (!orderId) {
      return res.status(400).json({ error: 'Thiếu orderId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    // Validate cancelReason
    if (!cancelReason) {
      return res.status(400).json({ error: 'Vui lòng chọn lý do hủy đơn hàng' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Kiểm tra quyền hủy đơn
    if (req.user && order.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền hủy đơn hàng này' });
    }

    // Kiểm tra trạng thái đơn hàng
    if (order.shippingStatus !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng khi đang chờ xử lý' });
    }

    // Validate cancellation reason enum
    const validReasons = [
      'Đổi ý không mua nữa',
      'Muốn thay đổi sản phẩm',
      'Thay đổi phương thức thanh toán', 
      'Thay đổi địa chỉ giao hàng',
      'Lý do khác'
    ];

    if (!validReasons.includes(cancelReason)) {
      return res.status(400).json({ error: 'Lý do hủy đơn không hợp lệ' });
    }

    // Cập nhật thông tin hủy đơn hàng
    order.shippingStatus = 'cancelled';
    order.paymentStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason;
    order.cancelNote = cancelNote || null;
    order.cancelledBy = req.user.id;

    await order.save();
    await order.populate('items.product');

    res.json({ 
      message: 'Hủy đơn hàng thành công',
      order: {
        ...order.toObject(),
        cancelReason,
        cancelNote,
        cancelledAt: order.cancelledAt
      }
    });

  } catch (error) {
    console.error('Lỗi khi hủy đơn hàng:', error);
    res.status(500).json({ error: 'Lỗi khi hủy đơn hàng' });
  }
};
exports.requestOrderReturn = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ token xác thực
    const { orderId } = req.params;
    const { returnReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }
    if (!returnReason) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do hoàn hàng' });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Kiểm tra thời gian yêu cầu hoàn hàng (3-4 ngày)
    const now = new Date();
    const orderDate = new Date(order.createdAt);
    const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 4) {
      return res.status(400).json({ error: 'Chỉ có thể yêu cầu hoàn hàng trong vòng 3-4 ngày kể từ khi đặt hàng' });
    }

    if (order.returnStatus !== 'none') {
      return res.status(400).json({ error: 'Yêu cầu hoàn hàng đã được gửi hoặc xử lý trước đó' });
    }

    if (order.shippingStatus !== 'delivered') {
      return res.status(400).json({ error: 'Chỉ có thể yêu cầu hoàn hàng khi đơn hàng đã được giao' });
    }

    order.returnStatus = 'requested';
    order.returnRequestDate = now;
    order.returnReason = returnReason;
    await order.save();

    await order.populate('items.product');
    res.json({ message: 'Yêu cầu hoàn hàng đã được gửi thành công', order });
  } catch (error) {
    console.error('Lỗi khi yêu cầu hoàn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi yêu cầu hoàn hàng', details: error.message });
  }
};

exports.confirmOrderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { returnStatus } = req.body; // 'approved' hoặc 'rejected'

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    if (!['approved', 'rejected'].includes(returnStatus)) {
      return res.status(400).json({ error: 'Trạng thái hoàn hàng không hợp lệ' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.returnStatus !== 'requested') {
      return res.status(400).json({ error: 'Đơn hàng không ở trạng thái yêu cầu hoàn hàng' });
    }

    order.returnStatus = returnStatus;
    if (returnStatus === 'approved') {
      order.shippingStatus = 'returned';
    }
    await order.save();

    await order.populate('items.product');
    res.json({ message: `Yêu cầu hoàn hàng đã được ${returnStatus === 'approved' ? 'chấp nhận' : 'từ chối'}`, order });
  } catch (error) {
    console.error('Lỗi khi xác nhận yêu cầu hoàn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi xác nhận yêu cầu hoàn hàng', details: error.message });
  }
};