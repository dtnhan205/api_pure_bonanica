const Coupon = require('../models/coupon');
const User = require('../models/user');
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
  userId: Joi.string()
    .optional()
    .allow(null)
    .custom((value, helpers) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid', { message: 'ID người dùng không hợp lệ' });
      }
      return value;
    }),
});

const bulkCouponValidationSchema = Joi.object({
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).default(0),
  expiryDays: Joi.number().min(1).required(),
  usageLimit: Joi.number().min(1).allow(null).optional(),
  target: Joi.string().valid('all', 'selected').required(),
  userIds: Joi.array()
    .items(
      Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: 'ID người dùng không hợp lệ' });
        }
        return value;
      })
    )
    .when('target', {
      is: 'selected',
      then: Joi.array().min(1).required(),
      otherwise: Joi.array().optional().allow(null),
    }),
});

// Hàm tạo mã ngẫu nhiên
const generateCouponCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = Array.from({ length: 8 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
    const existingCoupon = await Coupon.findOne({ code });
    if (!existingCoupon) return code;
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Could not generate unique coupon code after maximum attempts');
    }
  } while (true);
};

// Tạo mã giảm giá
exports.createCoupon = async (req, res) => {
  try {
    const { error, value } = couponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Validation error in createCoupon:', error.details);
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
    });

    await coupon.save();
    console.log(`Coupon created: ${coupon.code}`);
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Error in createCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá', details: error.message });
  }
};

// Tạo mã giảm giá hàng loạt
exports.createBulkCoupons = async (req, res) => {
  try {
    const { error, value } = bulkCouponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Validation error in createBulkCoupons:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    let eligibleUsers = [];
    if (value.target === 'all') {
      eligibleUsers = await User.find({}, '_id').lean();
    } else {
      eligibleUsers = await User.find({ _id: { $in: value.userIds } }, '_id').lean();
      if (eligibleUsers.length !== value.userIds.length) {
        return res.status(400).json({ error: 'Một số người dùng không tồn tại' });
      }
    }

    if (!eligibleUsers.length) {
      return res.status(400).json({ error: 'Không có người dùng hợp lệ để tạo mã giảm giá' });
    }

    const expiryDate = new Date(Date.now() + value.expiryDays * 24 * 60 * 60 * 1000);
    const coupons = await Promise.all(
      eligibleUsers.map(async (user) => {
        const code = await generateCouponCode();
        return {
          code,
          discountType: value.discountType,
          discountValue: value.discountValue,
          minOrderValue: value.minOrderValue || 0,
          expiryDate,
          usageLimit: value.usageLimit || 1,
          isActive: true,
          userId: user._id,
        };
      })
    );

    await Coupon.insertMany(coupons);
    console.log(`Created ${coupons.length} bulk coupons`);
    res.status(201).json({ message: `Tạo ${coupons.length} mã giảm giá thành công`, coupons });
  } catch (error) {
    console.error('Error in createBulkCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá hàng loạt', details: error.message });
  }
};

// Cập nhật mã giảm giá
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = couponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Validation error in updateCoupon:', error.details);
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
    });

    await coupon.save();
    console.log(`Coupon updated: ${coupon.code}`);
    res.json({ message: 'Cập nhật mã giảm giá thành công', coupon });
  } catch (error) {
    console.error('Error in updateCoupon:', error);
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

    console.log(`Coupon deleted: ${coupon.code}`);
    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    console.error('Error in deleteCoupon:', error);
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
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive usedCount userId')
      .populate('userId', 'email username')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await Coupon.countDocuments(query);

    console.log(`Fetched ${coupons.length} coupons for page ${page}`);
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
    console.error('Error in getCoupons:', error);
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
      .select('code discountType discountValue minOrderValue expiryDate usageLimit isActive userId')
      .populate('userId', 'email username')
      .lean();

    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
    }

    console.log(`Fetched coupon: ${coupon.code}`);
    res.json({ coupon });
  } catch (error) {
    console.error('Error in getCouponById:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết mã giảm giá', details: error.message });
  }
};

// Tạo mã tự động cho ngày đặc biệt
exports.createAutoSpecialCoupons = async (specialConfig) => {
  try {
    const eligibleUsers = await User.find({}, '_id').lean();
    if (!eligibleUsers.length) {
      console.warn('No users for auto coupon creation');
      return;
    }

    const expiryDate = new Date(Date.now() + specialConfig.expiryDays * 24 * 60 * 60 * 1000);
    const coupons = await Promise.all(
      eligibleUsers.map(async (user) => {
        const code = await generateCouponCode();
        return {
          code,
          discountType: specialConfig.discountType,
          discountValue: specialConfig.discountValue,
          minOrderValue: specialConfig.minOrderValue || 0,
          expiryDate,
          usageLimit: specialConfig.usageLimit || 1,
          isActive: true,
          userId: user._id,
        };
      })
    );

    await Coupon.insertMany(coupons);
    console.log(`Auto created ${coupons.length} special coupons on special day`);
  } catch (error) {
    console.error('Error in createAutoSpecialCoupons:', error);
  }
};

// Thiết lập config cho ngày đặc biệt
exports.setupAutoCoupons = async (req, res) => {
  try {
    const schema = Joi.object({
      discountType: Joi.string().valid('percentage', 'fixed').required(),
      discountValue: Joi.number().min(0).required(),
      minOrderValue: Joi.number().min(0).default(0),
      expiryDays: Joi.number().min(1).required(),
      usageLimit: Joi.number().min(1).allow(null).optional(),
      specialDays: Joi.array().items(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).required(),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    global.specialCouponConfig = value;
    console.log('Auto coupon config set:', value);
    res.status(200).json({ message: 'Thiết lập tự động tạo mã giảm giá thành công' });
  } catch (error) {
    console.error('Error in setupAutoCoupons:', error);
    res.status(500).json({ error: 'Lỗi server khi thiết lập tự động' });
  }
};

module.exports = exports;