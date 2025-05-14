const Order = require('../models/order');
const Users = require('../models/user'); 
const mongoose = require('mongoose');

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
      return res.status(400).json({ error: 'Thiếu userId trong URL. Vui lòng cung cấp userId trong đường dẫn (ví dụ: /admin/user/:userId)' });
    }

    // Kiểm tra ObjectId hợp lệ
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

    // Kiểm tra ObjectId hợp lệ
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

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    // Kiểm tra ObjectId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ _id: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng', details: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    // Kiểm tra ObjectId hợp lệ
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

    const order = await Order.findOne({ _id: orderId, user: userId }).populate(
      'items.product'
    );

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết đơn hàng', details: error.message });
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

    // Kiểm tra ObjectId hợp lệ
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

exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, note, productDetails, paymentStatus, total, address } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Thiếu orderId trong yêu cầu' });
    }

    // Kiểm tra ObjectId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (paymentStatus && !['pending', 'completed', 'failed', 'cancelled'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ' });
    }

    // Cập nhật các trường
    order.paymentMethod = paymentMethod || order.paymentMethod;
    order.note = note || order.note;
    order.productDetails = productDetails || order.productDetails;
    order.paymentStatus = paymentStatus || order.paymentStatus;
    order.total = total || order.total;

    // Xử lý address dưới dạng chuỗi
    if (address) {
      if (typeof address === 'object' && address.ward && address.district && address.city && address.province) {
        order.address = `${address.ward}, ${address.district}, ${address.city}, ${address.province}`;
      } else if (typeof address === 'string') {
        order.address = address;
      } else {
        return res.status(400).json({ error: 'Định dạng địa chỉ không hợp lệ' });
      }
    }

    await order.save();
    await order.populate('items.product');

    res.json({ message: 'Cập nhật đơn hàng thành công', order });
  } catch (error) {
    console.error('Lỗi khi cập nhật đơn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi cập nhật đơn hàng', details: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { orderId } = req.params;

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

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.paymentStatus !== 'pending') {
      let errorMessage = 'Chỉ có thể hủy đơn hàng ở trạng thái thanh toán đang chờ xử lý (pending)';
      if (order.paymentStatus === 'completed') {
        errorMessage = 'Không thể hủy đơn hàng vì thanh toán đã hoàn tất';
      } else if (order.paymentStatus === 'failed') {
        errorMessage = 'Không thể hủy đơn hàng vì thanh toán đã thất bại';
      } else if (order.paymentStatus === 'cancelled') {
        errorMessage = 'Đơn hàng đã bị hủy trước đó';
      }
      return res.status(400).json({ error: errorMessage });
    }

    order.paymentStatus = 'cancelled';
    await order.save();

    res.json({ message: 'Đã hủy đơn hàng thành công', order });
  } catch (error) {
    console.error('Lỗi khi hủy đơn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi hủy đơn hàng', details: error.message });
  }
};