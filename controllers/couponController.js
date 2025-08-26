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
  description: Joi.string().trim().max(200).default('').optional(), // Thêm validation cho description
});

const bulkCouponValidationSchema = Joi.object({
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).default(0),
  expiryDays: Joi.number().min(1).required(),
  usageLimit: Joi.number().min(1).allow(null).optional(),
  count: Joi.number().min(1).required(),
  description: Joi.string().trim().max(200).default('').optional(), // Thêm validation cho description
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

// Tạo mã giảm giá
exports.createCoupon = async (req, res) => {
  try {
    const { error, value } = couponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Lỗi xác thực trong createCoupon:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const existingCoupon = await Coupon.findOne({ code: value.code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }

    const coupon = new Coupon({
      ...value,
      code: value.code.toUpperCase(),
      expiryDate: value.expiryDate ? new Date(value.expiryDate) : null,
      description: value.description || '', // Đảm bảo description được lưu
    });

    await coupon.save();
    console.log(`Đã tạo mã giảm giá: ${coupon.code}, mô tả: ${coupon.description}`);
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi trong createCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá', details: error.message });
  }
};

// Tạo mã giảm giá hàng loạt
exports.createBulkCoupons = async (req, res) => {
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
          usageLimit: value.usageLimit || 1,
          isActive: true,
          description: value.description || '', // Lưu description
        };
      })
    );

    await Coupon.insertMany(coupons);
    console.log(`Đã tạo ${coupons.length} mã giảm giá hàng loạt, mô tả: ${value.description || 'Không có mô tả'}`);
    res.status(201).json({ message: `Tạo ${coupons.length} mã giảm giá thành công`, coupons });
  } catch (error) {
    console.error('Lỗi trong createBulkCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá hàng loạt', details: error.message });
  }
};

// Cập nhật mã giảm giá
exports.updateCoupon = async (req, res) => {
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

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    Object.assign(coupon, {
      ...value,
      code: value.code ? value.code.toUpperCase() : coupon.code,
      expiryDate: value.expiryDate ? new Date(value.expiryDate) : coupon.expiryDate,
      description: value.description !== undefined ? value.description : coupon.description, // Xử lý description
    });

    await coupon.save();
    console.log(`Đã cập nhật mã giảm giá: ${coupon.code}, mô tả: ${coupon.description}`);
    res.json({ message: 'Cập nhật mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Lỗi trong updateCoupon:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }
    res.status(500).json({ error: 'Lỗi server khi cập nhật mã giảm giá', details: error.message });
  }
};

// Xóa mã giảm giá
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

    console.log(`Đã xóa mã giảm giá: ${coupon.code}, mô tả: ${coupon.description}`);
    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    console.error('Lỗi trong deleteCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa mã giảm giá', details: error.message });
  }
};

// Lấy danh sách tất cả mã giảm giá
exports.getCoupons = async (req, res) => {
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
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount description') // Thêm description
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
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount description') // Thêm description
      .lean();

    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    console.log(`Đã lấy mã giảm giá: ${coupon.code}, mô tả: ${coupon.description}`);
    res.json({ coupon });
  } catch (error) {
    console.error('Lỗi trong getCouponById:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

// Tạo mã giảm giá tự động cho ngày đặc biệt
exports.createAutoSpecialCoupons = async (specialConfig) => {
  try {
    console.log('Bắt đầu createAutoSpecialCoupons với config:', specialConfig);
    
    const expiryDate = new Date(Date.now() + specialConfig.expiryDays * 24 * 60 * 60 * 1000);
    console.log('Ngày hết hạn tính toán:', expiryDate);

    const commonCode = await generateCouponCode();
    console.log('Mã giảm giá chung được tạo:', commonCode);

    const coupon = {
      code: commonCode,
      discountType: specialConfig.discountType,
      discountValue: specialConfig.discountValue,
      minOrderValue: specialConfig.minOrderValue || 0,
      expiryDate,
      usageLimit: specialConfig.usageLimit || 1,
      isActive: true,
      description: specialConfig.description || '', // Lưu description từ config
    };

    await Coupon.create(coupon);
    console.log(`Đã tạo mã giảm giá đặc biệt với mã ${commonCode}, mô tả: ${coupon.description} vào ${new Date().toLocaleDateString()}`);
  } catch (error) {
    console.error('Lỗi trong createAutoSpecialCoupons:', error);
    throw error;
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
      specialDays: Joi.array().items(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).required(),
      description: Joi.string().trim().max(200).default('').optional(), // Thêm validation cho description
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
    if (global.specialCouponConfig.specialDays.includes(today)) {
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
      usageLimit: 1,
      specialDays: [""],
      description: "", 
    };
    console.log('Cấu hình gửi đi:', config);
    res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('Lỗi trong getAutoSetupConfig:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy cấu hình tự động', details: error.message });
  }
};

module.exports = exports;