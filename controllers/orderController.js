const Order = require('../models/order');
const User = require('../models/user');

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy tất cả đơn hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy tất cả đơn hàng', details: error.message });
  }
};

exports.getOrdersByUserIdForAdmin = async (req, res) => {
  try {
    // Kiểm tra req.params trước khi truy cập userId
    if (!req.params || !req.params.userId) {
      return res.status(400).json({ error: 'Thiếu userId trong URL. Vui lòng cung cấp userId trong đường dẫn (ví dụ: /admin/user/:userId)' });
    }

    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ createdAt: -1 });

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

    const user = await User.findById(userId);
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
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết đơn hàng' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { orderId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (!['pending', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    order.status = status;
    await order.save();

    await order.populate('items.product');
    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công', order });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái đơn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái đơn hàng' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.status !== 'pending') {
      let errorMessage = 'Chỉ có thể hủy đơn hàng ở trạng thái đang chờ xử lý (pending)';
      if (order.status === 'shipped') {
        errorMessage = 'Không thể hủy đơn hàng vì đơn hàng đang được giao';
      } else if (order.status === 'delivered') {
        errorMessage = 'Không thể hủy đơn hàng vì đơn hàng đã được giao';
      } else if (order.status === 'cancelled') {
        errorMessage = 'Đơn hàng đã bị hủy trước đó';
      }
      return res.status(400).json({ error: errorMessage });
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Đã hủy đơn hàng thành công', order });
  } catch (error) {
    console.error('Lỗi khi hủy đơn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi hủy đơn hàng' });
  }
};