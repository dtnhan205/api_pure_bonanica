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
    if (duration > 15) {
      payment.status = 'expired';
      return false;
    }
    return true;
  }
};

// Error handling
const handleError = (res, error, statusCode = 500) => {
  console.error('Lỗi:', error.message, error.stack);
  return res.status(statusCode).json({
    status: 'error',
    message: error.message || 'Lỗi server nội bộ'
  });
};

// API service
const bankApiService = {
  fetchTransactions: async () => {
    const { API_KEY, API_USERNAME, API_PASSWORD, ACCOUNT_NO } = process.env;
    const ac = 1;

    try {
      const response = await axios.get(
        `https://apicanhan.com/api/mbbankv3?key=${API_KEY}&username=${API_USERNAME}&password=${API_PASSWORD}&accountNo=${ACCOUNT_NO}&ac=${ac}`
      );
      
      if (!response.data.transactions || !Array.isArray(response.data.transactions)) {
        throw new Error('Dữ liệu giao dịch từ API không hợp lệ');
      }
      return response.data.transactions;
    } catch (error) {
      console.error('Lỗi API Ngân hàng:', {
        message: error.message,
        response: error.response ? error.response.data : null
      });
      throw error;
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
        const normalizedTxAmount = parseFloat(tx.amount.replace(/[, ]/g, '')); // Xử lý dấu phẩy và khoảng trắng
        const codeMatch = tx.description.match(/thanhtoan(\d{5})/);
        const foundCode = codeMatch ? codeMatch[1] : null;

        console.log({
          txAmount: normalizedTxAmount,
          txCode: foundCode,
          txDuration,
          targetAmount: normalizedAmount,
          targetCode,
        }); // Debug: Kiểm tra các giá trị

        return (
          normalizedTxAmount === normalizedAmount &&
          foundCode === targetCode &&
          tx.type === 'IN' &&
          txDuration >= 0 &&
          txDuration <= 15
        );
      } catch (error) {
        console.error('Error in transaction matching:', error, tx);
        return false;
      }
    });
  }
};

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
    })
  })
};

// Tạo thanh toán mới
exports.createPayment = async (req, res) => {
  try {
    // Xác thực đầu vào
    const { error } = schemas.createPayment.validate(req.body);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { amount, orderId } = req.body;

    // Kiểm tra đơn hàng
    utils.validateObjectId(orderId, 'orderId');
    const order = await Order.findById(orderId);
    if (!order) {
      return handleError(res, new Error('Không tìm thấy đơn hàng'), 404);
    }

    // Tạo thanh toán
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



// Kiểm tra trạng thái thanh toán và tự động verify nếu khớp
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { error } = schemas.checkPaymentStatus.validate(req.params);
    if (error) return handleError(res, new Error(error.details[0].message), 400);

    const { paymentCode } = req.params;

    // Tìm thanh toán
    let payment = await Payment.findOne({ paymentCode })
      .select('paymentCode amount status transactionId createdAt orderId')
      .lean();

    if (!payment) {
      return handleError(res, new Error('Không tìm thấy thanh toán'), 404);
    }

    // Kiểm tra thời gian hết hạn
    if (payment.status === 'pending' && !utils.checkPaymentExpiration(payment)) {
      await Payment.updateOne({ _id: payment._id }, { status: 'expired' });
      payment.status = 'expired';
    }

    // Nếu trạng thái là pending và chưa hết hạn, kiểm tra giao dịch ngân hàng
    if (payment.status === 'pending' && utils.checkPaymentExpiration(payment)) {
      const transactions = await bankApiService.fetchTransactions();
      const matchingTransaction = bankApiService.findMatchingTransaction(transactions, paymentCode, payment.amount);

      if (matchingTransaction) {
        payment.status = 'success';
        payment.transactionId = matchingTransaction.transactionID;
        payment.description = matchingTransaction.description;
        payment.transactionDate = moment.tz(
          matchingTransaction.transactionDate.replace(/\\/g, '/'),
          'DD/MM/YYYY HH:mm:ss',
          'Asia/Ho_Chi_Minh'
        ).toDate();

        await Payment.updateOne(
          { _id: payment._id },
          {
            status: 'success',
            transactionId: matchingTransaction.transactionID,
            description: matchingTransaction.description,
            transactionDate: payment.transactionDate,
          }
        );

        // Cập nhật trạng thái đơn hàng
        const order = await Order.findById(payment.orderId);
        if (order) {
          order.paymentStatus = 'completed';
          await order.save();
        }

        return res.status(200).json({
          status: 'success',
          message: 'Xác minh thanh toán thành công',
          data: {
            paymentCode: payment.paymentCode,
            status: payment.status,
            transactionId: payment.transactionId,
            orderId: payment.orderId,
            paymentStatus: 'completed',
          },
        });
      }
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