const crypto = require('crypto');
const Payment = require('../models/vnPay');
const Order = require('../models/order');
const User = require('../models/user');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const Joi = require('joi');
require('dotenv').config();

const querystring = require('qs');

// Utility functions
const utils = {
  generatePaymentCode: () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `thanhtoan${randomNum}`;
  },

  validateObjectId: (id, type = 'ID') => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`${type} không hợp lệ`);
    }
  },

  validatePaymentCode: (code) => {
    if (!code.match(/^thanhtoan\d{5}$/)) {
      throw new Error('Mã thanh toán không hợp lệ');
    }
  },

  checkPaymentExpiration: (payment) => {
    const now = moment.tz('Asia/Ho_Chi_Minh');
    const createdAt = moment.tz(payment.createdAt, 'Asia/Ho_Chi_Minh');
    const duration = moment.duration(now.diff(createdAt)).asMinutes();
    console.log(`Check expiration: ${payment.paymentCode}, createdAt: ${createdAt.format()}, now: ${now.format()}, Duration: ${duration} minutes`);
    if (duration > 1440) {
      return { isValid: false, status: 'expired' };
    }
    return { isValid: true, status: 'pending' };
  }
};

// Error handling
const handleError = (res, error, statusCode = 500) => {
  console.error('Lỗi:', {
    message: error.message,
    stack: error.stack,
    timestamp: moment.tz('Asia/Ho_Chi_Minh').format(),
  });
  return res.status(statusCode).json({
    status: 'error',
    message: error.message || 'Lỗi server. Vui lòng thử lại sau',
  });
};

// Validation schemas
const schemas = {
  createPayment: Joi.object({
    amount: Joi.number().positive().required().messages({
      'number.base': 'Số tiền phải là số',
      'number.positive': 'Số tiền phải là số dương',
      'any.required': 'Thiếu số tiền'
    }),
    orderId: Joi.string().required().custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid', { message: 'OrderId không hợp lệ' });
      }
      return value;
    })
  }),
  verifyPayment: Joi.object({
    paymentCode: Joi.string().required().pattern(/^thanhtoan\d{5}$/).messages({
      'string.pattern.base': 'Mã thanh toán không hợp lệ',
      'any.required': 'Thiếu mã thanh toán'
    }),
    amount: Joi.number().positive().required().messages({
      'number.base': 'Số tiền phải là số',
      'number.positive': 'Số tiền phải là số dương',
      'any.required': 'Thiếu số tiền'
    })
  }),
  checkPaymentStatus: Joi.object({
    paymentCode: Joi.string().required().pattern(/^thanhtoan\d{5}$/).messages({
      'string.pattern.base': 'Mã thanh toán không hợp lệ',
      'any.required': 'Thiếu mã thanh toán'
    }),
    amount: Joi.number().positive().required().messages({
      'number.base': 'Số tiền phải là số',
      'number.positive': 'Số tiền phải là số dương',
      'any.required': 'Thiếu số tiền'
    })
  })
};

// VNPay service
const vnpayService = {
  createPaymentUrl: (req, paymentCode, amount, orderId) => {
    let date = new Date();
    let createDate = moment(date).tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss');
    let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';

    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: process.env.VNP_TMN_CODE,
      vnp_Amount: amount * 100,
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: ipAddr,
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang #${orderId} - ${paymentCode}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: process.env.VNP_RETURN_URL,
      vnp_TxnRef: paymentCode
    };

    console.log('vnp_Params before signing:', JSON.stringify(vnp_Params, null, 2));

    vnp_Params = sortObject(vnp_Params);
    let signData = querystring.stringify(vnp_Params, { encode: false });
    console.log('Sign Data:', signData);

    let hmac = crypto.createHmac('sha512', process.env.VNP_HASH_SECRET);
    let vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    console.log('Generated vnp_SecureHash:', vnp_SecureHash);

    vnp_Params['vnp_SecureHash'] = vnp_SecureHash;
    let paymentUrl = process.env.VNP_URL + '?' + querystring.stringify(vnp_Params, { encode: false });
    console.log('Generated Payment URL:', paymentUrl);

    return paymentUrl;
  },

  verifyReturn: (req) => {
    let vnp_Params = req.query;
    console.log('Raw req.query:', JSON.stringify(req.query, null, 2));

    if (!vnp_Params || typeof vnp_Params !== 'object') {
      console.error('Invalid vnp_Params:', vnp_Params);
      return false;
    }

    let secureHash = vnp_Params['vnp_SecureHash'];
    console.log('Received vnp_SecureHash:', secureHash);

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let signData = querystring.stringify(vnp_Params, { encode: false });
    console.log('Verify Sign Data:', signData);

    let hmac = crypto.createHmac('sha512', process.env.VNP_HASH_SECRET);
    let checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    console.log('Calculated checkHash:', checkHash);

    const isValid = secureHash === checkHash && vnp_Params['vnp_ResponseCode'] === '00';
    console.log('Signature Validation Result:', isValid);
    return isValid;
  }
};

function sortObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    console.error('sortObject received invalid input:', obj);
    return {};
  }

  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) { // Sử dụng Object.prototype.hasOwnProperty.call để an toàn hơn
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}

// Tạo thanh toán mới với VNPay
exports.createPayment = async (req, res) => {
  try {
    const { error } = schemas.createPayment.validate(req.body);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { amount, orderId } = req.body;

    utils.validateObjectId(orderId, 'orderId');
    const order = await Order.findById(orderId);
    if (!order) {
      return handleError(res, new Error('Không tìm thấy đơn hàng'), 404);
    }

    const paymentCode = utils.generatePaymentCode();
    const payment = new Payment({ paymentCode, orderId, amount });
    await payment.save();

    const paymentUrl = vnpayService.createPaymentUrl(req, paymentCode, amount, orderId);
    return res.status(201).json({
      status: 'success',
      message: 'Tạo thanh toán thành công',
      data: { paymentUrl, paymentCode, amount, orderId }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Xác minh thanh toán thủ công (POST)
exports.verifyPayment = async (req, res) => {
  try {
    const { error } = schemas.verifyPayment.validate(req.body);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { paymentCode, amount } = req.body;

    const payment = await Payment.findOne({ paymentCode, status: 'pending' }).populate('orderId');
    if (!payment) {
      return handleError(res, new Error('Thanh toán không tồn tại hoặc đã được xử lý'), 404);
    }

    if (!payment.orderId) {
      return handleError(res, new Error('Không tìm thấy đơn hàng liên quan'), 404);
    }

    if (!utils.checkPaymentExpiration(payment).isValid) {
      await payment.save();
      return handleError(res, new Error('Thanh toán đã hết hạn'), 400);
    }

    if (payment.amount !== amount) {
      return handleError(res, new Error('Số tiền không khớp với thanh toán'), 400);
    }

    payment.status = 'success';
    payment.transactionId = 'manual_transaction_id';
    await payment.save();

    payment.orderId.paymentStatus = 'completed';
    payment.orderId.shippingStatus = 'pending';
    await payment.orderId.save();

    return res.status(200).json({
      status: 'success',
      message: 'Xác minh thanh toán thành công (thủ công)',
      data: {
        transactionId: payment.transactionId,
        orderId: payment.orderId._id,
        paymentStatus: payment.orderId.paymentStatus,
        shippingStatus: payment.orderId.shippingStatus
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Xử lý phản hồi từ VNPay (GET)
exports.handleVnpayReturn = async (req, res) => {
  try {
    console.log('Processing vnpay-return with req.query:', JSON.stringify(req.query, null, 2));
    if (vnpayService.verifyReturn(req)) {
      const vnp_Params = req.query;
      const paymentCode = vnp_Params['vnp_TxnRef'];
      console.log('Found paymentCode:', paymentCode);

      const payment = await Payment.findOne({ paymentCode, status: 'pending' }).populate('orderId');
      if (!payment) {
        return handleError(res, new Error('Thanh toán không tồn tại hoặc đã được xử lý'), 404);
      }

      if (!payment.orderId) {
        return handleError(res, new Error('Không tìm thấy đơn hàng liên quan'), 404);
      }

      if (!utils.checkPaymentExpiration(payment).isValid) {
        await payment.save();
        return handleError(res, new Error('Thanh toán đã hết hạn'), 400);
      }

      payment.status = 'success';
      payment.transactionId = vnp_Params['vnp_TransactionNo'];
      payment.description = vnp_Params['vnp_OrderInfo'];
      payment.transactionDate = moment.tz(vnp_Params['vnp_PayDate'], 'YYYYMMDDHHmmss', 'Asia/Ho_Chi_Minh').toDate();
      await payment.save();
      console.log('Payment updated:', payment);

      payment.orderId.paymentStatus = 'completed';
      payment.orderId.shippingStatus = 'pending';
      await payment.orderId.save();
      console.log('Order updated:', payment.orderId);

      return res.status(200).json({
        status: 'success',
        message: 'Xác minh thanh toán từ VNPay thành công',
        data: {
          transactionId: payment.transactionId,
          orderId: payment.orderId._id,
          paymentStatus: payment.orderId.paymentStatus,
          shippingStatus: payment.orderId.shippingStatus
        }
      });
    } else {
      return handleError(res, new Error('Xác minh chữ ký thất bại'), 400);
    }
  } catch (error) {
    return handleError(res, error);
  }
};

// Kiểm tra trạng thái thanh toán
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { error } = schemas.checkPaymentStatus.validate(req.body);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { paymentCode, amount } = req.body;

    const payment = await Payment.findOne({ paymentCode, status: 'pending' })
      .select('paymentCode amount status transactionId createdAt orderId')
      .lean();

    if (!payment) {
      return handleError(res, new Error('Không tìm thấy thanh toán'), 404);
    }

    const { isValid, status } = utils.checkPaymentExpiration(payment);
    if (!isValid) {
      await Payment.updateOne({ _id: payment._id }, { status });
      return res.status(200).json({
        status: 'success',
        data: {
          paymentCode: payment.paymentCode,
          status,
          transactionId: payment.transactionId || null,
        },
      });
    }

    if (payment.amount !== amount) {
      return handleError(res, new Error('Số tiền không khớp với thanh toán'), 400);
    }

    const order = await Order.findById(payment.orderId);
    if (order && order.paymentStatus === 'completed') {
      return res.status(200).json({
        status: 'success',
        data: {
          paymentCode: payment.paymentCode,
          status: 'success',
          transactionId: payment.transactionId || null,
          orderId: payment.orderId,
          paymentStatus: 'completed',
          shippingStatus: 'pending',
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        paymentCode: payment.paymentCode,
        status: payment.status,
        transactionId: payment.transactionId || null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = exports;