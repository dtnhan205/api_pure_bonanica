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
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
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
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const coupons = await Coupon.find()
      .select('-usedCount')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Coupon.countDocuments();

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

    const coupon = await Coupon.findById(id).select('-usedCount');
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    res.json({ message: 'Lấy chi tiết mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết mã giảm giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

module.exports = {
  createCoupon: exports.createCoupon,
  updateCoupon: exports.updateCoupon,
  deleteCoupon: exports.deleteCoupon,
  getCoupons: exports.getCoupons,
  getCouponById: exports.getCouponById,
};