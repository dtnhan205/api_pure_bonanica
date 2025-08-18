const Coupon = require('../models/coupon');
const mongoose = require('mongoose');

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderValue,
      expiryDate,
      usageLimit,
      isActive,
      userId,
      orderId,
      isBirthdayCoupon
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá không hợp lệ' });
    }

    if (expiryDate && isNaN(new Date(expiryDate).getTime())) {
      return res.status(400).json({ error: 'Ngày hết hạn không hợp lệ' });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });
    }

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }

    const coupon = new Coupon({
      code,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      usageLimit: usageLimit || null,
      isActive: isActive !== undefined ? isActive : true,
      userId: userId || null,
      orderId: orderId || null,
      isBirthdayCoupon: isBirthdayCoupon || false
    });

    await coupon.save();
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi tạo mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi tạo mã giảm giá', details: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    if (updates.userId && !mongoose.Types.ObjectId.isValid(updates.userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    if (updates.orderId && !mongoose.Types.ObjectId.isValid(updates.orderId)) {
      return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });
    }

    if (updates.discountType && !['percentage', 'fixed'].includes(updates.discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    Object.assign(coupon, updates);
    await coupon.save();
    res.json({ message: 'Cập nhật mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi cập nhật mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi cập nhật mã giảm giá', details: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    res.json({ message: 'Xóa mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi xóa mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi xóa mã giảm giá', details: error.message });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};

    const coupons = await Coupon.find(query)
      .select('-usedCount')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('userId', 'email username')
      .populate('orderId', 'orderCode totalAmount');

    const total = await Coupon.countDocuments(query);

    res.json({
      message: 'Lấy danh sách mã giảm giá thành công',
      coupons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách mã giảm giá', details: error.message });
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findById(id)
      .select('-usedCount')
      .populate('userId', 'email username')
      .populate('orderId', 'orderCode totalAmount');
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    res.json({ message: 'Lấy chi tiết mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

exports.checkCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.body;

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    const query = { code, isActive: true };
    if (userId) {
      query.userId = mongoose.Types.ObjectId(userId);
    }

    const coupon = await Coupon.findOne(query).populate('userId', 'email username birthday');
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại hoặc không hoạt động' });
    }

    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
      return res.status(400).json({ error: 'Mã giảm giá đã hết hạn' });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
    }

    if (coupon.isBirthdayCoupon && coupon.userId && userId) {
      const user = coupon.userId;
      const today = new Date();
      const birthday = new Date(user.birthday);
      const isBirthday = today.getMonth() === birthday.getMonth() && today.getDate() === birthday.getDate();
      if (!isBirthday) {
        return res.status(400).json({ error: 'Mã giảm giá chỉ áp dụng vào ngày sinh nhật' });
      }
    }

    res.json({ message: 'Mã giảm giá hợp lệ', coupon });
  } catch (error) {
    console.error('Lỗi khi kiểm tra mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi kiểm tra mã giảm giá', details: error.message });
  }
};

exports.createBirthdayCoupon = async (req, res) => {
  try {
    const { userId, discountValue, expiryDays = 7 } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({ error: 'Giá trị giảm giá không hợp lệ' });
    }

    const user = await mongoose.model('user').findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const code = `BDAY${userId.slice(-6)}${Math.random().toString(36).slice(-4).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    const existingCoupon = await Coupon.findOne({ userId, isBirthdayCoupon: true });
    if (existingCoupon && existingCoupon.expiryDate > new Date()) {
      return res.status(400).json({ error: 'Người dùng đã có mã giảm giá sinh nhật còn hiệu lực' });
    }

    const coupon = new Coupon({
      code,
      discountType: 'percentage',
      discountValue,
      minOrderValue: 0,
      expiryDate,
      usageLimit: 1,
      isActive: true,
      userId,
      isBirthdayCoupon: true
    });

    await coupon.save();
    res.status(201).json({ message: 'Tạo mã giảm giá sinh nhật thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi tạo mã giảm giá sinh nhật:', error.stack);
    res.status(500).json({ error: 'Lỗi khi tạo mã giảm giá sinh nhật', details: error.message });
  }
};

module.exports = {
  createCoupon: exports.createCoupon,
  updateCoupon: exports.updateCoupon,
  deleteCoupon: exports.deleteCoupon,
  getCoupons: exports.getCoupons,
  getCouponById: exports.getCouponById,
  checkCoupon: exports.checkCoupon,
  createBirthdayCoupon: exports.createBirthdayCoupon,
};