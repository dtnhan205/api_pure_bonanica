const Coupon = require('../models/coupon');
const Joi = require('joi');
const mongoose = require('mongoose');

// Validation schemas
const couponValidationSchema = Joi.object({
  code: Joi.string().min(3).max(20).required(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).default(0),
  expiryDate: Joi.date().allow(null).optional(),
  usageLimit: Joi.number().min(1).allow(null).optional(),
  isActive: Joi.boolean().default(true),
  description: Joi.string().trim().max(200).default('').optional(),
});

const bulkCouponValidationSchema = Joi.object({
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).default(0),
  expiryDays: Joi.number().min(1).required(),
  usageLimit: Joi.number().min(1).allow(null).optional(),
  count: Joi.number().min(1).required(),
  description: Joi.string().trim().max(200).default('').optional(),
});

// Hàm tạo mã ngẫu nhiên
const generateCouponCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = Array.from({ length: 10 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
    const existingCoupon = await Coupon.findOne({ code });
    if (!existingCoupon) return code;
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Không thể tạo mã giảm giá duy nhất sau số lần thử tối đa');
    }
  } while (true);
};

// Hàm kiểm tra và cập nhật trạng thái isActive
const updateCouponStatus = async (coupon, session = null) => {
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    coupon.isActive = false;
    await coupon.save({ session });
    console.log(`Đã cập nhật mã giảm giá ${coupon.code} thành không hoạt động do đạt giới hạn sử dụng`);
  }
};

// Tạo mã giảm giá
exports.createCoupon = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { error, value } = couponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Lỗi xác thực trong createCoupon:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const existingCoupon = await Coupon.findOne({ code: value.code.toUpperCase() }).session(session);
    if (existingCoupon) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }

    const coupon = new Coupon({
      ...value,
      code: value.code.toUpperCase(),
      expiryDate: value.expiryDate ? new Date(value.expiryDate) : null,
    });

    await coupon.save({ session });
    console.log(`Đã tạo mã giảm giá: ${coupon.code}`);
    await session.commitTransaction();
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', coupon });
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong createCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá', details: error.message });
  } finally {
    session.endSession();
  }
};

// Tạo mã giảm giá hàng loạt
exports.createBulkCoupons = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { error, value } = bulkCouponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Lỗi xác thực trong createBulkCoupons:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const expiryDate = new Date(Date.now() + value.expiryDays * 24 * 60 * 60 * 1000);
    const coupons = await Promise.all(
      Array.from({ length: value.count }, async () => {
        const code = await generateCouponCode();
        return {
          code,
          discountType: value.discountType,
          discountValue: value.discountValue,
          minOrderValue: value.minOrderValue || 0,
          expiryDate,
          usageLimit: value.usageLimit || null, // Đảm bảo usageLimit được thiết lập đúng
          isActive: true,
          description: value.description || '',
        };
      })
    );

    const insertedCoupons = await Coupon.insertMany(coupons, { session });
    console.log(`Đã tạo ${coupons.length} mã giảm giá hàng loạt`);
    await session.commitTransaction();
    res.status(201).json({ message: `Tạo ${coupons.length} mã giảm giá thành công`, coupons: insertedCoupons });
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong createBulkCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá hàng loạt', details: error.message });
  } finally {
    session.endSession();
  }
};

// Cập nhật mã giảm giá
exports.updateCoupon = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { error, value } = couponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Lỗi xác thực trong updateCoupon:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findById(id).session(session);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    Object.assign(coupon, {
      ...value,
      code: value.code ? value.code.toUpperCase() : coupon.code,
      expiryDate: value.expiryDate ? new Date(value.expiryDate) : coupon.expiryDate,
    });

    await updateCouponStatus(coupon, session); // Kiểm tra trạng thái sau khi cập nhật
    await coupon.save({ session });
    console.log(`Đã cập nhật mã giảm giá: ${coupon.code}`);
    await session.commitTransaction();
    res.json({ message: 'Cập nhật mã giảm giá thành công', coupon });
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong updateCoupon:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }
    res.status(500).json({ error: 'Lỗi server khi cập nhật mã giảm giá', details: error.message });
  } finally {
    session.endSession();
  }
};

// Xóa mã giảm giá
exports.deleteCoupon = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findByIdAndDelete(id).session(session);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    console.log(`Đã xóa mã giảm giá: ${coupon.code}`);
    await session.commitTransaction();
    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong deleteCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa mã giảm giá', details: error.message });
  } finally {
    session.endSession();
  }
};

// Lấy danh sách tất cả mã giảm giá
exports.getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 9, code } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { isActive: true };

    if (code) {
      query.code = { $regex: code, $options: 'i' };
    }

    const coupons = await Coupon.find(query)
      .select(
        'code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount description'
      )
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await Coupon.countDocuments(query);

    console.log(`Đã lấy ${coupons.length} mã giảm giá (isActive=true) cho trang ${page}`);
    res.json({
      coupons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi trong getCoupons:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy danh sách mã giảm giá',
      details: error.message,
    });
  }
};

// Lấy danh sách mã giảm giá cho admin
exports.getCouponsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 9, code, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (code) {
      query.code = { $regex: code, $options: 'i' };
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const coupons = await Coupon.find(query)
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount description')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await Coupon.countDocuments(query);

    console.log(`Đã lấy ${coupons.length} mã giảm giá cho trang ${page}`);
    res.json({
      coupons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi trong getCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách mã giảm giá', details: error.message });
  }
};

// Lấy chi tiết mã giảm giá
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID mã giảm giá không hợp lệ' });
    }

    const coupon = await Coupon.findById(id)
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount description')
      .lean();

    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    console.log(`Đã lấy mã giảm giá: ${coupon.code}`);
    res.json({ coupon });
  } catch (error) {
    console.error('Lỗi trong getCouponById:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

// Tạo mã giảm giá tự động cho ngày đặc biệt
exports.createAutoSpecialCoupons = async (specialConfig) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Bắt đầu createAutoSpecialCoupons với config:', specialConfig);
    
    const expiryDate = new Date(Date.now() + specialConfig.expiryDays * 24 * 60 * 60 * 1000);
    console.log('Ngày hết hạn tính toán:', expiryDate);

    const today = new Date().toISOString().slice(0, 10);
    const dayConfig = specialConfig.specialDays.find(d => d.date === today);
    const description = dayConfig ? dayConfig.description : 'Mã giảm giá tự động';

    const commonCode = await generateCouponCode();
    console.log('Mã giảm giá chung được tạo:', commonCode);

    const coupon = {
      code: commonCode,
      discountType: specialConfig.discountType,
      discountValue: specialConfig.discountValue,
      minOrderValue: specialConfig.minOrderValue || 0,
      expiryDate,
      usageLimit: specialConfig.usageLimit || null,
      isActive: true,
      description,
    };

    const createdCoupon = await Coupon.create([coupon], { session });
    console.log(`Đã tạo mã giảm giá đặc biệt với mã ${commonCode} vào ${new Date().toLocaleDateString()}`);
    await session.commitTransaction();
    return createdCoupon[0];
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong createAutoSpecialCoupons:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Thiết lập tự động tạo mã giảm giá
exports.setupAutoCoupons = async (req, res) => {
  try {
    console.log('Nhận yêu cầu trong setupAutoCoupons:', req.body);
    const schema = Joi.object({
      discountType: Joi.string().valid('percentage', 'fixed').required(),
      discountValue: Joi.number().min(0).required(),
      minOrderValue: Joi.number().min(0).default(0),
      expiryDays: Joi.number().min(1).required(),
      usageLimit: Joi.number().min(1).allow(null).optional(),
      specialDays: Joi.array().items(Joi.object({
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        description: Joi.string().trim().max(200).default('').optional(),
      })).required(),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      console.log('Lỗi xác thực trong setupAutoCoupons:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    global.specialCouponConfig = value;
    console.log('Cấu hình tự động mã giảm giá được thiết lập:', global.specialCouponConfig);

    const today = new Date().toISOString().slice(0, 10);
    console.log('Hôm nay là:', today);
    if (global.specialCouponConfig.specialDays.some(d => d.date === today)) {
      console.log('Khớp với ngày đặc biệt, tạo mã ngay lập tức...');
      await exports.createAutoSpecialCoupons(global.specialCouponConfig);
      console.log('Đã tạo mã giảm giá cho ngày đặc biệt:', today);
    } else {
      console.log('Không khớp ngày đặc biệt, bỏ qua việc tạo.');
    }

    res.status(200).json({ message: 'Thiết lập tự động tạo mã giảm giá thành công' });
  } catch (error) {
    console.error('Lỗi trong setupAutoCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi thiết lập tự động' });
  }
};

// Lấy cấu hình tự động
exports.getAutoSetupConfig = async (req, res) => {
  try {
    console.log('Bắt đầu getAutoSetupConfig');
    const config = global.specialCouponConfig || {
      discountType: "percentage",
      discountValue: 15,
      minOrderValue: 0,
      expiryDays: 7,
      usageLimit: null,
      specialDays: [
        { date: "2025-09-02", description: "Ngày Quốc Khánh" },
        { date: "2026-01-01", description: "Năm Mới" }
      ],
    };
    console.log('Cấu hình gửi đi:', config);
    res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('Lỗi trong getAutoSetupConfig:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy cấu hình tự động', details: error.message });
  }
};

// Hàm áp dụng mã giảm giá
exports.applyCoupon = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { code, orderValue } = req.body;

    // Xác thực đầu vào
    const schema = Joi.object({
      code: Joi.string().required(),
      orderValue: Joi.number().min(0).required(),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Lỗi xác thực trong applyCoupon:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const coupon = await Coupon.findOne({ code: value.code.toUpperCase() }).session(session);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    // Kiểm tra trạng thái mã giảm giá
    if (!coupon.isActive) {
      return res.status(400).json({ error: 'Mã giảm giá không hoạt động' });
    }

    // Kiểm tra ngày hết hạn
    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
      coupon.isActive = false;
      await coupon.save({ session });
      return res.status(400).json({ error: 'Mã giảm giá đã hết hạn' });
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (value.orderValue < coupon.minOrderValue) {
      return res.status(400).json({ error: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã này` });
    }

    // Kiểm tra giới hạn sử dụng
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      coupon.isActive = false;
      await coupon.save({ session });
      return res.status(400).json({ error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
    }

    // Tăng số lần sử dụng
    coupon.usedCount += 1;

    // Kiểm tra và cập nhật trạng thái isActive
    await updateCouponStatus(coupon, session);

    // Tính toán giá trị giảm giá
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (coupon.discountValue / 100) * value.orderValue;
    } else if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
    }

    await coupon.save({ session });
    console.log(`Đã áp dụng mã giảm giá: ${coupon.code}, usedCount: ${coupon.usedCount}`);

    await session.commitTransaction();
    res.json({
      message: 'Áp dụng mã giảm giá thành công',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        isActive: coupon.isActive,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Lỗi trong applyCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi áp dụng mã giảm giá', details: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = exports;