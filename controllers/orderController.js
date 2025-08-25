const Order = require('../models/order');
const Users = require('../models/user');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Define failReasonMapping for Vietnamese translations
const failReasonMapping = {
  delivery_error: "Lỗi vận chuyển",
  address_issue: "Sai địa chỉ",
  timeout: "Quá thời gian giao hàng",
  other: "Khác",
};

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Lỗi xác minh transporter:', error.message);
  } else {
    console.log('Transporter đã sẵn sàng để gửi email');
  }
});

// Helper function to get translated fail reason
const getTranslatedFailReason = (reason) => {
  return failReasonMapping[reason] || reason || 'Lý do không xác định';
};

// Helper function to send return status email
const sendReturnStatusEmail = async (order, returnStatus) => {
  try {
    if (!order.user || !order.user.email) {
      throw new Error('Email người dùng không tồn tại hoặc không hợp lệ');
    }

    // Re-verify transporter before sending
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          reject(new Error(`Lỗi xác minh transporter: ${error.message}`));
        } else {
          resolve(success);
        }
      });
    });

    const emailSubject = returnStatus === 'approved'
      ? 'Yêu cầu hoàn hàng được chấp nhận - Pure-Botanica 🌿'
      : 'Yêu cầu hoàn hàng bị từ chối - Pure-Botanica 🌿';

    const emailContent = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
          <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">
            ${returnStatus === 'approved' ? 'Yêu cầu hoàn hàng được chấp nhận' : 'Yêu cầu hoàn hàng bị từ chối'}
          </h1>
        </div>
        <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
          <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
            Yêu cầu hoàn hàng của bạn cho đơn hàng <strong>#${order._id}</strong> đã được <strong>${returnStatus === 'approved' ? 'chấp nhận' : 'từ chối'}</strong> vào ngày <strong>${new Date().toLocaleDateString('vi-VN')}</strong>.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
            ${returnStatus === 'approved' ? `
              <strong>Quy trình hoàn hàng:</strong><br>
              - Shipper sẽ đến lấy hàng trong vòng <strong>1-2 ngày làm việc</strong>.<br>
              - Sau khi nhận được hàng, chúng tôi sẽ liên hệ với bạn để hoàn tất thủ tục hoàn tiền.<br>
              Vui lòng chuẩn bị hàng hóa và liên hệ với chúng tôi nếu có bất kỳ câu hỏi nào.
            ` : `
              <strong>Lý do:</strong> Đơn hàng không đủ điều kiện hoàn hàng theo chính sách của chúng tôi.<br>
              Để biết thêm chi tiết hoặc thảo luận thêm, vui lòng liên hệ với chúng tôi qua email hoặc hotline.
            `}
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
          </div>
          <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
            Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
          <div style="margin-bottom: 15px;">
            <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
              <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
            </a>
            <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
              <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
            </a>
          </div>
          <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
          <p style="margin: 0;">
            Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
            <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
          </p>
        </div>
      </div>
    `;

    // Attempt to send email with retry (up to 3 attempts)
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const emailResult = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: order.user.email,
          subject: emailSubject,
          html: emailContent,
        });
        console.log(`✅ Email gửi thành công tới: ${order.user.email}, Message ID: ${emailResult.messageId}`);
        return { success: true, messageId: emailResult.messageId };
      } catch (emailError) {
        attempts++;
        console.warn(`⚠️ Thử gửi email lần ${attempts} thất bại: ${emailError.message}`);
        if (attempts === maxAttempts) {
          throw emailError;
        }
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (emailError) {
    console.error(`❌ Không thể gửi email thông báo hoàn hàng cho ${order.user.email}:`, emailError.message);
    console.error('🔍 Chi tiết lỗi email:', emailError.stack);
    return { success: false, error: emailError.message };
  }
};

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

exports.getReturnRequestsForAdmin = async (req, res) => {
  try {
    const returnRequests = await Order.find({ returnStatus: 'requested' })
      .populate('items.product', 'name price image')
      .populate('user', 'username email')
      .sort({ returnRequestDate: -1 });

    res.json(returnRequests);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu hoàn hàng (admin):', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách yêu cầu hoàn hàng', details: error.message });
  }
};

exports.getFailedOrders = async (req, res) => {
  try {
    const failedOrders = await Order.find({ shippingStatus: 'failed' })
      .populate('items.product', 'name price image')
      .populate('user', 'username email')
      .sort({ updatedAt: -1 });

    res.json(failedOrders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng giao thất bại:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng giao thất bại', details: error.message });
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

    if (!orderId) {
      return res.status(400).json({ error: 'Thiếu orderId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    if (!cancelReason) {
      return res.status(400).json({ error: 'Vui lòng chọn lý do hủy đơn hàng' });
    }

    const order = await Order.findById(orderId).populate('user', 'username email');
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (req.user && order.user._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền hủy đơn hàng này' });
    }

    if (order.shippingStatus !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng khi đang chờ xử lý' });
    }

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

    order.shippingStatus = 'cancelled';
    order.paymentStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason;
    order.cancelNote = cancelNote || null;
    order.cancelledBy = req.user.id;

    await order.save();
    await order.populate('items.product');

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.user.email,
        subject: 'Thông báo hủy đơn hàng - Pure-Botanica 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Thông báo hủy đơn hàng</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Đơn hàng của bạn với mã <strong>#${order._id}</strong> đã được hủy thành công vào ngày <strong>${new Date(order.cancelledAt).toLocaleDateString('vi-VN')}</strong>.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                <strong>Lý do hủy:</strong> ${cancelReason}<br>
                ${cancelNote ? `<strong>Ghi chú:</strong> ${cancelNote}<br>` : ''}
                Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                </a>
                <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                </a>
              </div>
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">
                Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
              </p>
            </div>
          </div>
        `
      });
      console.log(`Đã gửi email thông báo hủy đơn hàng tới: ${order.user.email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo hủy đơn hàng cho ${order.user.email}:`, emailError.message);
    }

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
    const userId = req.user._id;
    const { orderId } = req.params;
    const { returnReason } = req.body;

    console.log(`📝 Bắt đầu xử lý yêu cầu hoàn hàng cho orderId: ${orderId}, userId: ${userId}`);
    console.log('📝 Body:', req.body);
    console.log('📝 Files:', req.files);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }
    if (!returnReason) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do hoàn hàng' });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).populate('user', 'username email');
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

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

    let returnImages = [];
    let returnVideos = [];

    if (req.files) {
      if (req.files.images) {
        if (req.files.images.length > 5) {
          return res.status(400).json({ error: 'Tối đa 5 ảnh' });
        }
        returnImages = req.files.images.map(file => ({
          url: file.path,
          public_id: file.filename
        }));
      }
      if (req.files.orderVideo) {
        if (req.files.orderVideo.length > 1) {
          return res.status(400).json({ error: 'Tối đa 1 video' });
        }
        returnVideos = req.files.orderVideo.map(file => ({
          url: file.path,
          public_id: file.filename
        }));
      }
    } else {
      console.log('No files uploaded');
    }

    order.returnStatus = 'requested';
    order.returnRequestDate = now;
    order.returnReason = returnReason;
    order.returnImages = returnImages;
    order.returnVideos = returnVideos;
    await order.save();

    await order.populate('items.product');

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.user.email,
        subject: 'Yêu cầu hoàn hàng đã được gửi - Pure-Botanica 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Yêu cầu hoàn hàng</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Yêu cầu hoàn hàng của bạn cho đơn hàng <strong>#${order._id}</strong> đã được gửi thành công vào ngày <strong>${now.toLocaleDateString('vi-VN')}</strong>.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                <strong>Lý do hoàn hàng:</strong> ${returnReason}<br>
                ${returnImages.length > 0 ? `<strong>Hình ảnh:</strong> ${returnImages.map(img => img.url).join(', ')}<br>` : ''}
                ${returnVideos.length > 0 ? `<strong>Video:</strong> ${returnVideos.map(vid => vid.url).join(', ')}<br>` : ''}
                Chúng tôi sẽ xem xét yêu cầu của bạn và phản hồi trong vòng <strong>3-4 ngày làm việc</strong>.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                </a>
                <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                </a>
              </div>
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">
                Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
              </p>
            </div>
          </div>
        `
      });
      console.log(`Đã gửi email thông báo yêu cầu hoàn hàng tới: ${order.user.email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo hoàn hàng cho ${order.user.email}:`, emailError.message);
    }

    res.json({ message: 'Yêu cầu hoàn hàng đã được gửi thành công', order });
  } catch (error) {
    console.error('Lỗi khi yêu cầu hoàn hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi yêu cầu hoàn hàng', details: error.message });
  }
};

exports.confirmOrderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { returnStatus } = req.body;

    console.log(`📝 Bắt đầu xử lý xác nhận hoàn hàng cho orderId: ${orderId}, trạng thái: ${returnStatus}`);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error(`❌ orderId không hợp lệ: ${orderId}`);
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    if (!['approved', 'rejected'].includes(returnStatus)) {
      console.error(`❌ Trạng thái hoàn hàng không hợp lệ: ${returnStatus}`);
      return res.status(400).json({ error: 'Trạng thái hoàn hàng không hợp lệ' });
    }

    const order = await Order.findById(orderId).populate('user', 'username email');
    if (!order) {
      console.error(`❌ Không tìm thấy đơn hàng với orderId: ${orderId}`);
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.returnStatus !== 'requested') {
      console.error(`❌ Đơn hàng không ở trạng thái yêu cầu hoàn hàng. Trạng thái hiện tại: ${order.returnStatus}`);
      return res.status(400).json({ error: 'Đơn hàng không ở trạng thái yêu cầu hoàn hàng' });
    }

    // Kiểm tra email user trước khi cập nhật
    if (!order.user || !order.user.email) {
      console.error(`❌ Email người dùng không tồn tại: ${order.user}`);
      return res.status(400).json({ error: 'Email người dùng không tồn tại' });
    }

    console.log(`📧 Email người dùng: ${order.user.email}`);

    order.returnStatus = returnStatus;
    if (returnStatus === 'approved') {
      order.shippingStatus = 'returned';
    }
    await order.save();
    console.log(`✅ Đã cập nhật trạng thái đơn hàng: ${orderId}, returnStatus: ${returnStatus}, shippingStatus: ${order.shippingStatus}`);

    await order.populate('items.product');

    // GỬI EMAIL TRỰC TIẾP (như các function khác)
    let emailStatus = 'Email sent successfully';
    try {
      console.log('📧 Bắt đầu gửi email xác nhận hoàn hàng...');
      
      // Re-verify transporter
      await new Promise((resolve, reject) => {
        transporter.verify((error, success) => {
          if (error) {
            reject(new Error(`Lỗi xác minh transporter: ${error.message}`));
          } else {
            console.log('✅ Transporter verified successfully');
            resolve(success);
          }
        });
      });

      const emailSubject = returnStatus === 'approved'
        ? 'Yêu cầu hoàn hàng được chấp nhận - Pure-Botanica 🌿'
        : 'Yêu cầu hoàn hàng bị từ chối - Pure-Botanica 🌿';

      const emailContent = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
          <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
            <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">
              ${returnStatus === 'approved' ? 'Yêu cầu hoàn hàng được chấp nhận' : 'Yêu cầu hoàn hàng bị từ chối'}
            </h1>
          </div>
          <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
            <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
              Yêu cầu hoàn hàng của bạn cho đơn hàng <strong>#${order._id}</strong> đã được <strong>${returnStatus === 'approved' ? 'chấp nhận' : 'từ chối'}</strong> vào ngày <strong>${new Date().toLocaleDateString('vi-VN')}</strong>.
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
              ${returnStatus === 'approved' ? `
                <strong>Quy trình hoàn hàng:</strong><br>
                - Shipper sẽ đến lấy hàng trong vòng <strong>1-2 ngày làm việc</strong>.<br>
                - Sau khi nhận được hàng, chúng tôi sẽ liên hệ với bạn để hoàn tất thủ tục hoàn tiền.<br>
                Vui lòng chuẩn bị hàng hóa và liên hệ với chúng tôi nếu có bất kỳ câu hỏi nào.
              ` : `
                <strong>Lý do:</strong> Đơn hàng không đủ điều kiện hoàn hàng theo chính sách của chúng tôi.<br>
                Để biết thêm chi tiết hoặc thảo luận thêm, vui lòng liên hệ với chúng tôi qua email hoặc hotline.
              `}
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
            </div>
            <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
              Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
            <div style="margin-bottom: 15px;">
              <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
              </a>
              <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
              </a>
            </div>
            <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
            <p style="margin: 0;">
              Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
              <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
            </p>
          </div>
        </div>
      `;

      // Gửi email với retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      let emailSent = false;
      
      while (attempts < maxAttempts && !emailSent) {
        try {
          console.log(`📧 Thử gửi email lần ${attempts + 1}/${maxAttempts} tới: ${order.user.email}`);
          
          const emailResult = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: order.user.email,
            subject: emailSubject,
            html: emailContent,
          });
          
          console.log(`✅ Email gửi thành công tới: ${order.user.email}, Message ID: ${emailResult.messageId}`);
          emailSent = true;
          emailStatus = `Email sent successfully - Message ID: ${emailResult.messageId}`;
        } catch (emailError) {
          attempts++;
          console.warn(`⚠️ Thử gửi email lần ${attempts} thất bại: ${emailError.message}`);
          
          if (attempts === maxAttempts) {
            throw emailError;
          }
          
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (emailError) {
      console.error(`❌ Không thể gửi email thông báo hoàn hàng cho ${order.user.email}:`, emailError.message);
      console.error('🔍 Chi tiết lỗi email:', emailError.stack);
      emailStatus = `Email failed: ${emailError.message}`;
    }

    res.json({ 
      message: `Yêu cầu hoàn hàng đã được ${returnStatus === 'approved' ? 'chấp nhận' : 'từ chối'}`,
      order,
      emailStatus
    });
  } catch (error) {
    console.error('❌ Lỗi khi xác nhận yêu cầu hoàn hàng:', error.message);
    console.error('🔍 Chi tiết lỗi:', error.stack);
    res.status(500).json({ error: 'Lỗi khi xác nhận yêu cầu hoàn hàng', details: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    const allowedFields = [
      'shippingStatus', 
      'paymentStatus', 
      'returnStatus', 
      'cancelReason',
      'failReason',
      'shippingAddress', 
      'items', 
      'totalPrice'
    ];
    
    const updateFields = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields[key] = value;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu hợp lệ để cập nhật' });
    }

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (updateFields.shippingStatus) {
      const validStatuses = ['pending', 'in_transit', 'delivered', 'returned', 'cancelled', 'failed'];
      if (!validStatuses.includes(updateFields.shippingStatus)) {
        return res.status(400).json({ error: 'Trạng thái vận chuyển không hợp lệ' });
      }
    }

    if (updateFields.paymentStatus) {
      const validPaymentStatuses = ['pending', 'completed', 'failed', 'cancelled'];
      if (!validPaymentStatuses.includes(updateFields.paymentStatus)) {
        return res.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ' });
      }
    }

    if (updateFields.returnStatus) {
      const validReturnStatuses = ['none', 'requested', 'approved', 'rejected'];
      if (!validReturnStatuses.includes(updateFields.returnStatus)) {
        return res.status(400).json({ error: 'Trạng thái hoàn hàng không hợp lệ' });
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      updateFields, 
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Không thể cập nhật đơn hàng' });
    }

    const populatedOrder = await Order.findById(orderId)
      .populate('items.product')
      .populate('user', 'username email');

    if (updateFields.shippingStatus === 'failed') {
      try {
        const translatedFailReason = getTranslatedFailReason(updateFields.failReason);
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: populatedOrder.user.email,
          subject: 'Thông báo giao hàng thất bại - Pure-Botanica 🌿',
          html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
              <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
                <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Thông báo giao hàng thất bại</h1>
              </div>
              <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${populatedOrder.user.username},</h3>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                  Đơn hàng của bạn với mã <strong>#${populatedOrder._id}</strong> không thể được giao thành công vào ngày <strong>${new Date().toLocaleDateString('vi-VN')}</strong>.
                </p>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                  <strong>Lý do:</strong> ${translatedFailReason}.<br>
                  Vui lòng liên hệ với chúng tôi qua email hoặc hotline để được hỗ trợ thêm.
                </p>
                <div style="text-align: center; margin: 25px 0;">
                  <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
                </div>
                <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                  Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
                <div style="margin-bottom: 15px;">
                  <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                    <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                  </a>
                  <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                    <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                  </a>
                </div>
                <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
                <p style="margin: 0;">
                  Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                  <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
                </p>
              </div>
            </div>
          `
        });
        console.log(`Đã gửi email thông báo giao hàng thất bại tới: ${populatedOrder.user.email}`);
      } catch (emailError) {
        console.error(`Lỗi gửi email thông báo giao hàng thất bại: ${emailError.message}`);
      }
    }

    res.json({ 
      message: 'Cập nhật đơn hàng thành công', 
      order: populatedOrder 
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật đơn hàng:', error.stack);
    res.status(500).json({ 
      error: 'Lỗi khi cập nhật đơn hàng', 
      details: error.message 
    });
  }
};

exports.markOrderAsFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { failReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'orderId không hợp lệ' });
    }

    if (!failReason) {
      return res.status(400).json({ error: 'Vui lòng cung cấp lý do giao hàng thất bại' });
    }

    const order = await Order.findById(orderId).populate('user', 'username email');
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    order.shippingStatus = 'failed';
    order.paymentStatus = 'failed';
    order.failReason = failReason;
    await order.save();

    await order.populate('items.product');

    try {
      const translatedFailReason = getTranslatedFailReason(failReason);
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.user.email,
        subject: 'Thông báo giao hàng thất bại - Pure-Botanica 🌿',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
              <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Thông báo giao hàng thất bại</h1>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
              <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                Đơn hàng của bạn với mã <strong>#${order._id}</strong> không thể được giao thành công vào ngày <strong>${new Date().toLocaleDateString('vi-VN')}</strong>.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                <strong>Lý do:</strong> ${translatedFailReason}.<br>
                Vui lòng liên hệ với chúng tôi qua email hoặc hotline để được hỗ trợ thêm.
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
              </div>
              <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                </a>
                <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                </a>
              </div>
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">
                Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
              </p>
            </div>
          </div>
        `
      });
      console.log(`Đã gửi email thông báo giao hàng thất bại tới: ${order.user.email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email thông báo giao hàng thất bại: ${emailError.message}`);
    }

    res.json({ message: 'Đã đánh dấu đơn hàng giao thất bại', order });
  } catch (error) {
    console.error('Lỗi khi đánh dấu giao hàng thất bại:', error.message);
    res.status(500).json({ error: 'Lỗi khi đánh dấu giao hàng thất bại', details: error.message });
  }
};

exports.checkFailedDeliveries = async () => {
  try {
    const thresholdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const failedOrders = await Order.find({
      shippingStatus: 'in_transit',
      updatedAt: { $lt: thresholdDate }
    }).populate('user', 'username email');

    for (const order of failedOrders) {
      order.shippingStatus = 'failed';
      order.paymentStatus = 'failed';
      order.failReason = 'timeout';
      await order.save();

      try {
        const translatedFailReason = getTranslatedFailReason(order.failReason);
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: order.user.email,
          subject: 'Thông báo giao hàng thất bại - Pure-Botanica 🌿',
          html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
              <div style="text-align: center; background-color: #ffffff; padding: 30px; border-radius: 10px 10px 0 0; border-top: 4px solid #357E38;">
                <h1 style="color: #357E38; font-size: 26px; font-weight: 600; margin: 0;">Thông báo giao hàng thất bại</h1>
              </div>
              <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #333; font-size: 20px; margin: 0 0 15px;">Xin chào ${order.user.username},</h3>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                  Đơn hàng của bạn với mã <strong>#${order._id}</strong> không thể được giao thành công do quá thời gian vận chuyển.
                </p>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                  <strong>Lý do:</strong> ${translatedFailReason}.<br>
                  Vui lòng liên hệ với chúng tôi qua email hoặc hotline để được hỗ trợ thêm.
                </p>
                <div style="text-align: center; margin: 25px 0;">
                  <a href="mailto:purebotanicastore@gmail.com" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500;">Liên hệ ngay</a>
                </div>
                <p style="color: #777; font-size: 14px; line-height: 1.5; margin: 20px 0 0;">
                  Cảm ơn bạn đã tin tưởng và đồng hành cùng Pure-Botanica!
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
                <div style="margin-bottom: 15px;">
                  <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                    <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                  </a>
                  <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                    <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                  </a>
                </div>
                <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
                <p style="margin: 0;">
                  Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                  <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
                </p>
              </div>
            </div>
          `
        });
        console.log(`Đã gửi email thông báo giao hàng thất bại tới: ${order.user.email}`);
      } catch (emailError) {
        console.error(`Lỗi gửi email thông báo giao hàng thất bại: ${emailError.message}`);
      }
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra giao hàng thất bại:', error.message);
  }
};