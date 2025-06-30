const axios = require('axios');
const Payment = require('../models/Payment');
const Order = require('../models/order');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const Joi = require('joi');
require('dotenv').config();

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
    if (duration > 1440) { // 24 giờ = 1440 phút
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

// API service
const bankApiService = {
  fetchTransactions: async () => {
    const { API_KEY, API_USERNAME, API_PASSWORD, ACCOUNT_NO } = process.env;
    const ac = 1;

    try {
      console.log('Fetching transactions with:', { API_KEY: '***', ACCOUNT_NO });
      const response = await axios.get(
        `https://apicanhan.com/api/mbbankv3?key=${API_KEY}&username=${API_USERNAME}&password=${API_PASSWORD}&accountNo=${ACCOUNT_NO}&ac=${ac}`,
        { timeout: 10000 }
      );
      
      console.log('API response:', response.data);
      if (!response.data || typeof response.data !== 'object') {
        console.warn('Phản hồi không hợp lệ:', response.data);
        return [];
      }
      if (!response.data.transactions || !Array.isArray(response.data.transactions)) {
        console.warn('Transactions không phải mảng hoặc không tồn tại:', response.data);
        return [];
      }
      console.log('Fetched transactions count:', response.data.transactions.length);
      return response.data.transactions;
    } catch (error) {
      console.error('Lỗi API Ngân hàng:', {
        message: error.message,
        response: error.response ? error.response.data : null,
        status: error.response ? error.response.status : null,
        code: error.code,
      });
      return [];
    }
  },

  findMatchingTransaction: (transactions, paymentCode, amount) => {
    const targetCode = paymentCode.replace('thanhtoan', '');
    const normalizedAmount = parseFloat(amount);

    return transactions.find((tx) => {
      try {
        const txMoment = moment.tz(
          tx.transactionDate.replace(/\\/g, '/').trim(),
          'DD/MM/YYYY HH:mm:ss',
          'Asia/Ho_Chi_Minh'
        );
        const txDuration = moment.duration(moment.tz('Asia/Ho_Chi_Minh').diff(txMoment)).asMinutes();
        const normalizedTxAmount = parseFloat(tx.amount.replace(/[, ]/g, ''));
        const codeMatch = tx.description.match(/thanhtoan(\d{5})/);
        const foundCode = codeMatch ? codeMatch[1] : null;

        console.log({
          txAmount: normalizedTxAmount,
          txCode: foundCode,
          txDuration,
          targetAmount: normalizedAmount,
          targetCode,
        });

        return (
          Math.abs(normalizedTxAmount - normalizedAmount) < 1 && // Cho phép sai số nhỏ
          foundCode === targetCode &&
          tx.type === 'IN' &&
          txDuration >= 0 &&
          txDuration <= 1440 // Cập nhật thời gian tối đa thành 24 giờ
        );
      } catch (error) {
        console.error('Error in transaction matching:', error.message, tx);
        return false;
      }
    });
  }
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

// Tạo thanh toán mới
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

    return res.status(201).json({
      status: 'success',
      message: 'Tạo thanh toán thành công',
      data: { paymentCode, amount, orderId }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Xác minh giao dịch ngân hàng và cập nhật trạng thái đơn hàng
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

    const transactions = await bankApiService.fetchTransactions();
    const matchingTransaction = bankApiService.findMatchingTransaction(transactions, paymentCode, amount);

    if (!matchingTransaction) {
      return handleError(res, new Error('Không tìm thấy giao dịch khớp trong vòng 24 giờ'), 400);
    }

    payment.status = 'success';
    payment.transactionId = matchingTransaction.transactionID;
    payment.description = matchingTransaction.description;
    payment.transactionDate = moment.tz(
      matchingTransaction.transactionDate.replace(/\\/g, '/'),
      'DD/MM/YYYY HH:mm:ss',
      'Asia/Ho_Chi_Minh'
    ).toDate();
    await payment.save();

    payment.orderId.paymentStatus = 'completed';
    await payment.orderId.save();

    return res.status(200).json({
      status: 'success',
      message: 'Xác minh thanh toán thành công',
      data: {
        transactionId: matchingTransaction.transactionID,
        orderId: payment.orderId._id,
        paymentStatus: payment.orderId.paymentStatus
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Kiểm tra trạng thái thanh toán và tự động verify nếu khớp
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { error } = schemas.checkPaymentStatus.validate(req.body);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { paymentCode, amount } = req.body;

    // Tìm payment và order liên quan
    const payment = await Payment.findOne({ paymentCode, status: 'pending' })
      .select('paymentCode amount status transactionId createdAt orderId')
      .lean();

    if (!payment) {
      return handleError(res, new Error('Không tìm thấy thanh toán'), 404);
    }

    // Kiểm tra thời gian hết hạn
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

    // Kiểm tra amount khớp với payment
    if (payment.amount !== amount) {
      return handleError(res, new Error('Số tiền không khớp với thanh toán'), 400);
    }

    // Lấy giao dịch từ ngân hàng
    const transactions = await bankApiService.fetchTransactions();
    console.log('Transactions fetched:', transactions.length);
    const matchingTransaction = bankApiService.findMatchingTransaction(transactions, paymentCode, amount);

    if (matchingTransaction) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          status: 'success',
          transactionId: matchingTransaction.transactionID,
          description: matchingTransaction.description,
          transactionDate: moment.tz(
            matchingTransaction.transactionDate.replace(/\\/g, '/'),
            'DD/MM/YYYY HH:mm:ss',
            'Asia/Ho_Chi_Minh'
          ).toDate(),
        }
      );

      // Cập nhật trạng thái đơn hàng
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'completed';
        order.shippingStatus = 'pending'; 
        await order.save();
      } else {
        console.warn(`Order not found for payment: ${payment._id}`);
      }

      return res.status(200).json({
        status: 'success',
        message: 'Xác minh thanh toán thành công',
        data: {
          paymentCode: payment.paymentCode,
          status: 'success',
          transactionId: matchingTransaction.transactionID,
          orderId: payment.orderId,
          paymentStatus: 'completed',
          shippingStatus: 'pending', 
        },
      });
    }

    // Nếu không tìm thấy giao dịch khớp, trả về trạng thái hiện tại
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