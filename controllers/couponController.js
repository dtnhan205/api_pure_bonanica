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

const singleCouponValidationSchema = Joi.object({
  userId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid', { message: 'ID người dùng không hợp lệ' });
      }
      return value;
    }),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).default(0),
  expiryDays: Joi.number().min(1).required(),
  usageLimit: Joi.number().min(1).allow(null).optional(),
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

// Tạo mã giảm giá cho một người dùng
exports.createSingleCoupon = async (req, res) => {
  try {
    const { error, value } = singleCouponValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.warn('Validation error in createSingleCoupon:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const user = await User.findById(value.userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const code = await generateCouponCode();
    const expiryDate = new Date(Date.now() + value.expiryDays * 24 * 60 * 60 * 1000);

    const coupon = new Coupon({
      code,
      discountType: value.discountType,
      discountValue: value.discountValue,
      minOrderValue: value.minOrderValue || 0,
      expiryDate,
      usageLimit: value.usageLimit || 1,
      isActive: true,
      userId: value.userId,
    });

    await coupon.save();
    console.log(`Single coupon created: ${coupon.code} for user ${value.userId}`);
    res.status(201).json({ message: 'Tạo mã giảm giá cho người dùng thành công', coupon });
  } catch (error) {
    console.error('Error in createSingleCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá đơn lẻ', details: error.message });
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

// Lấy danh sách mã giảm giá
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

    console.log(`Fetched ${coupons.length} coupons for page ${page} with usedCount:`, coupons.map(c => c.usedCount));
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

// Kiểm tra mã giảm giá
exports.checkCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId, orderValue = 0 } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Mã giảm giá là bắt buộc' });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    const query = { code: code.toUpperCase(), isActive: true };
    if (userId) query.userId = userId;

    const coupon = await Coupon.findOne(query)
      .select('code discountType discountValue minOrderValue expiryDate usageLimit usedCount')
      .populate('userId', 'email username')
      .lean();

    if (!coupon) {
      return res.status(404).json({ error: 'Mã giảm giá không tồn tại hoặc không hoạt động' });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ error: 'Mã giảm giá đã hết hạn' });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
    }

    if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
      return res.status(400).json({ error: `Đơn hàng phải đạt tối thiểu ${coupon.minOrderValue.toLocaleString()} VNĐ` });
    }

    console.log(`Coupon checked: ${coupon.code}`);
    res.json({
      message: 'Mã giảm giá hợp lệ',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        expiryDate: coupon.expiryDate,
      },
    });
  } catch (error) {
    console.error('Error in checkCoupon:', error);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra mã giảm giá', details: error.message });
  }
};

// Lấy danh sách mã giảm giá theo userId
exports.getCouponsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 9, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const query = { userId };
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

    console.log(`Fetched ${coupons.length} coupons for user ${userId} with usedCount:`, coupons.map(c => c.usedCount));
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
    console.error('Error in getCouponsByUserId:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách mã giảm giá theo người dùng', details: error.message });
  }
};

module.exports = exports;