const axios = require('axios');
const Payment = require('../models/Payment');
const Order = require('../models/order');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

// Load biến môi trường
require('dotenv').config();

// Utility function outside the class
const generatePaymentCode = () => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `thanhtoan${randomNum}`;
};

class PaymentController {
  // Create a new payment
  static async createPayment(req, res) {
    const { amount, orderId } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Số tiền phải là số dương' });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ status: 'error', message: 'OrderId không hợp lệ' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng' });
    }

    const paymentCode = generatePaymentCode();
    const payment = new Payment({ paymentCode, orderId, amount });
    await payment.save();

    res.status(201).json({ status: 'success', message: 'Tạo thanh toán thành công', paymentCode, amount, orderId });
  }

  // Verify bank transaction and update order status
  static async verifyPayment(req, res) {
    const { paymentCode, amount } = req.body;

    // Kiểm tra đầu vào
    if (!paymentCode || !paymentCode.match(/^thanhtoan\d{5}$/)) {
      return res.status(400).json({ status: 'error', message: 'Mã thanh toán không hợp lệ' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Số tiền phải là số dương' });
    }

    // Debug: In dữ liệu đầu vào
    console.log('Request body:', { paymentCode, amount });

    const payment = await Payment.findOne({ paymentCode, status: 'pending' }).populate('orderId');
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Thanh toán không tồn tại hoặc đã được xử lý' });
    }

    const order = payment.orderId;
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng liên quan' });
    }

    // Kiểm tra thời gian hết hạn
    const now = moment.tz('Asia/Ho_Chi_Minh');
    const createdAt = moment.tz(payment.createdAt, 'Asia/Ho_Chi_Minh');
    const duration = moment.duration(now.diff(createdAt)).asMinutes();

    // Debug: In thời gian
    console.log('Payment details:', {
      paymentCode,
      createdAt: createdAt.format(),
      now: now.format(),
      durationMinutes: duration,
    });

    if (duration > 15) {
      payment.status = 'expired';
      await payment.save();
      return res.status(400).json({ status: 'error', message: 'Thanh toán đã hết hạn' });
    }

    // Thông tin API
    const apiKey = process.env.API_KEY;
    const username = process.env.API_USERNAME;
    const password = process.env.API_PASSWORD;
    const accountNo = process.env.ACCOUNT_NO;
    const ac = 1;

    // Debug: In thông tin API
    console.log('API Credentials:', { apiKey, username, password, accountNo, ac });

    try {
      const response = await axios.get(
        `https://apicanhan.com/api/mbbankv3?key=${apiKey}&username=${username}&password=${password}&accountNo=${accountNo}&ac=${ac}`
      );

      const { transactions } = response.data;
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(500).json({ status: 'error', message: 'Dữ liệu giao dịch từ API không hợp lệ' });
      }

      // Debug: In danh sách giao dịch
      console.log('Transactions:', JSON.stringify(transactions, null, 2));

      // Tìm giao dịch khớp
      const targetCode = paymentCode.replace('thanhtoan', '');
      const normalizedAmount = parseFloat(amount);
      const matchingTransaction = transactions.find((tx) => {
        const txMoment = moment.tz(tx.transactionDate.replace(/\\/g, '/'), 'DD/MM/YYYY HH:mm:ss', 'Asia/Ho_Chi_Minh');
        const txDuration = moment.duration(now.diff(txMoment)).asMinutes();
        const normalizedTxAmount = parseFloat(tx.amount.replace(/,/g, ''));

        // Kiểm tra thanhtoan + targetCode
        const codeMatch = tx.description.match(/thanhtoan(\d{5})/);
        const foundCode = codeMatch ? codeMatch[1] : null;

        // Debug: In chi tiết giao dịch
        console.log('Checking transaction:', {
          transactionID: tx.transactionID,
          description: tx.description,
          foundCode,
          targetCode,
          amount: normalizedTxAmount,
          expectedAmount: normalizedAmount,
          duration: txDuration,
          type: tx.type,
        });

        return (
          normalizedTxAmount === normalizedAmount &&
          foundCode === targetCode &&
          tx.type === 'IN' &&
          txDuration <= 15
        );
      });

      if (matchingTransaction) {
        payment.status = 'success';
        payment.transactionId = matchingTransaction.transactionID;
        payment.description = matchingTransaction.description;
        payment.transactionDate = moment.tz(matchingTransaction.transactionDate.replace(/\\/g, '/'), 'DD/MM/YYYY HH:mm:ss', 'Asia/Ho_Chi_Minh').toDate();
        await payment.save();

        // Cập nhật trạng thái đơn hàng
        order.paymentStatus = 'completed';
        await order.save();

        return res.status(200).json({
          status: 'success',
          message: 'Xác minh thanh toán thành công',
          transactionId: matchingTransaction.transactionID,
          orderId: order._id,
          paymentStatus: order.paymentStatus,
        });
      } else {
        return res.status(400).json({ status: 'error', message: 'Không tìm thấy giao dịch khớp trong vòng 15 phút' });
      }
    } catch (error) {
      console.error('API Error:', {
        message: error.message,
        response: error.response ? error.response.data : null,
        status: error.response ? error.response.status : null,
      });
      return res.status(500).json({ status: 'error', message: 'Không thể lấy lịch sử giao dịch' });
    }
  }

  // Check payment status
  static async checkPaymentStatus(req, res) {
    const { paymentCode } = req.params;

    const payment = await Payment.findOne({ paymentCode }).populate('orderId');
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy thanh toán' });
    }

    const order = payment.orderId;
    return res.status(200).json({
      status: 'success',
      payment: {
        paymentCode,
        amount: payment.amount,
        status: payment.status,
        transactionId: payment.transactionId,
        orderId: order ? order._id : null,
        orderStatus: order ? order.paymentStatus : null,
      },
    });
  }
}

module.exports = PaymentController;