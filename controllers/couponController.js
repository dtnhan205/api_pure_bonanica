const Coupon = require('../models/Coupon');
const User = require('../models/user');
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
      userId
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (code, discountType, discountValue)' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá phải là percentage hoặc fixed' });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ error: 'Giá trị giảm phải lớn hơn 0' });
    }

    if (expiryDate && isNaN(new Date(expiryDate).getTime())) {
      return res.status(400).json({ error: 'Ngày hết hạn không hợp lệ' });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      usageLimit: usageLimit || null,
      isActive: isActive !== undefined ? isActive : true,
      userId: userId || null
    });

    await coupon.save();
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi tạo mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá', details: error.message });
  }
};

exports.createSingleCoupon = async (req, res) => {
  try {
    const { userId, discountType, discountValue, minOrderValue, expiryDays, usageLimit } = req.body;

    if (!userId || !discountType || !discountValue || !expiryDays) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (userId, discountType, discountValue, expiryDays)' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá phải là percentage hoặc fixed' });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ error: 'Giá trị giảm phải lớn hơn 0' });
    }

    if (expiryDays < 1) {
      return res.status(400).json({ error: 'Số ngày hiệu lực phải lớn hơn hoặc bằng 1' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const code = `PROMO-${userId}-${Date.now()}`;
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ error: `Mã ${code} đã tồn tại` });
    }

    const coupon = new Coupon({
      code,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      usageLimit: usageLimit || 1,
      isActive: true,
      userId
    });

    await coupon.save();
    res.status(201).json({ message: 'Tạo mã giảm giá cho người dùng thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi tạo mã giảm giá đơn lẻ:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá đơn lẻ', details: error.message });
  }
};

exports.createBulkCoupons = async (req, res) => {
  try {
    const { discountType, discountValue, minOrderValue, expiryDays, usageLimit, target, userIds } = req.body;

    if (!discountType || !discountValue || !expiryDays || !target) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (discountType, discountValue, expiryDays, target)' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá phải là percentage hoặc fixed' });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ error: 'Giá trị giảm phải lớn hơn 0' });
    }

    if (expiryDays < 1) {
      return res.status(400).json({ error: 'Số ngày hiệu lực phải lớn hơn hoặc bằng 1' });
    }

    if (target === 'selected' && (!userIds || !Array.isArray(userIds) || !userIds.length)) {
      return res.status(400).json({ error: 'Danh sách userIds không hợp lệ hoặc rỗng' });
    }

    let eligibleUsers = [];
    if (target === 'selected') {
      eligibleUsers = await User.find({ _id: { $in: userIds } });
    } else if (target === 'all') {
      eligibleUsers = await User.find({});
    } else {
      return res.status(400).json({ error: 'Mục tiêu không hợp lệ (phải là all hoặc selected)' });
    }

    if (!eligibleUsers.length) {
      return res.status(400).json({ error: 'Không có người dùng hợp lệ để tạo mã giảm giá' });
    }

    const coupons = await Promise.all(
      eligibleUsers.map(async (user, index) => {
        const code = `BULK-${Date.now()}-${index + 1}`;
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
          throw new Error(`Mã ${code} đã tồn tại`);
        }
        return new Coupon({
          code,
          discountType,
          discountValue,
          minOrderValue: minOrderValue || 0,
          expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
          usageLimit: usageLimit || 1,
          isActive: true,
          userId: user._id
        }).save();
      })
    );

    res.status(201).json({ message: `Tạo ${coupons.length} mã giảm giá thành công`, coupons });
  } catch (error) {
    console.error('Lỗi khi tạo mã giảm giá hàng loạt:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá hàng loạt', details: error.message });
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

    if (updates.discountType && !['percentage', 'fixed'].includes(updates.discountType)) {
      return res.status(400).json({ error: 'Loại giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    Object.assign(coupon, { ...updates, code: updates.code ? updates.code.toUpperCase() : coupon.code });
    await coupon.save();
    res.json({ message: 'Cập nhật mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi cập nhật mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi cập nhật mã giảm giá', details: error.message });
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
    res.status(500).json({ error: 'Lỗi server khi xóa mã giảm giá', details: error.message });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, code, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (code) query.code = { $regex: code, $options: 'i' };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const coupons = await Coupon.find(query)
      .select('-usedCount')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('userId', 'email username');

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
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách mã giảm giá', details: error.message });
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
      .populate('userId', 'email username');
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    res.json({ message: 'Lấy chi tiết mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

exports.checkCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId, orderValue } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Mã giảm giá là bắt buộc' });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    const query = { code: code.toUpperCase(), isActive: true };
    if (userId) query.userId = userId;

    const coupon = await Coupon.findOne(query)
      .populate('userId', 'email username');

    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại hoặc không hoạt động' });
    }

    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
      return res.status(400).json({ error: 'Mã giảm giá đã hết hạn' });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
    }

    if (coupon.minOrderValue && (!orderValue || orderValue < coupon.minOrderValue)) {
      return res.status(400).json({ error: `Đơn hàng phải đạt tối thiểu ${coupon.minOrderValue.toLocaleString()} VNĐ` });
    }

    res.json({
      message: 'Mã giảm giá hợp lệ',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        expiryDate: coupon.expiryDate
      }
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra mã giảm giá', details: error.message });
  }
};