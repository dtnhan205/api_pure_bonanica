const mongoose = require('mongoose');
const Cart = require('../models/cart');
const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order');
const Coupon = require('../models/coupon');
const axios = require('axios');
const VnpayController = require('./vnpayController');
require('dotenv').config();

exports.getAllCarts = async (req, res) => {
  try {
    const carts = await Cart.find()
      .populate({
        path: 'user',
        select: 'username email'
      })
      .populate({
        path: 'items.product',
        select: 'name images option'
      });

    if (!carts || carts.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng nào' });
    }

    const formattedCarts = carts.map(cart => {
      const items = cart.items.map(item => {
        const product = item.product;
        const option = product?.option?.find(opt => opt._id.toString() === item.optionId.toString());
        
        return {
          product: product ? {
            _id: product._id,
            name: product.name,
            images: product.images || []
          } : null,
          option: option ? {
            _id: option._id,
            value: option.value,
            price: option.price,
            discount_price: option.discount_price || 0,
            stock: option.stock
          } : null,
          quantity: item.quantity
        };
      });

      return {
        _id: cart._id,
        user: cart.user ? {
          _id: cart.user._id,
          username: cart.user.username,
          email: cart.user.email
        } : null,
        items,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt
      };
    });

    res.json(formattedCarts);
  } catch (error) {
    console.error('Lỗi khi lấy tất cả giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy tất cả giỏ hàng', details: error.message });
  }
};

exports.getCartItems = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name images option'
      });

    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    const items = cart.items.map(item => {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      return {
        product: {
          _id: product._id,
          name: product.name,
          images: product.images || []
        },
        option: option ? {
          _id: option._id,
          value: option.value,
          price: option.price,
          discount_price: option.discount_price || 0,
          stock: option.stock
        } : null,
        quantity: item.quantity
      };
    });

    res.json({
      _id: cart._id,
      user: cart.user,
      items
    });
  } catch (error) {
    console.error('Lỗi khi lấy giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy giỏ hàng', details: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId, optionIds = [], quantity = 1 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'Thiếu productId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'productId không hợp lệ' });
    }

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ error: 'Thiếu hoặc không hợp lệ optionIds trong yêu cầu' });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải là số nguyên lớn hơn 0' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    for (const optionId of optionIds) {
      if (!mongoose.Types.ObjectId.isValid(optionId)) {
        return res.status(400).json({ error: `optionId ${optionId} không hợp lệ` });
      }

      const option = product.option.find(opt => opt._id.toString() === optionId.toString());
      if (!option) {
        return res.status(404).json({ error: `Biến thể sản phẩm với optionId ${optionId} không tồn tại` });
      }

      if (option.stock < quantity) {
        return res.status(400).json({ error: `Biến thể ${option.value} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu` });
      }

      const existingItem = cart.items.find(item => 
        item.product.toString() === productId && item.optionId.toString() === optionId
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (option.stock < newQuantity) {
          return res.status(400).json({ error: `Biến thể ${option.value} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu` });
        }
        existingItem.quantity = newQuantity;
      } else {
        cart.items.push({ product: productId, optionId, quantity });
      }
    }

    await cart.save();
    await cart.populate({
      path: 'items.product',
      select: 'name images option'
    });
    res.json(cart);
  } catch (error) {
    console.error('Lỗi thêm sản phẩm vào giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi thêm sản phẩm vào giỏ hàng', details: error.message });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId || req.user?.id; // Sử dụng req.user nếu có
    const { productId, optionId, quantity } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    if (!productId || !optionId) {
      return res.status(400).json({ error: 'Thiếu productId hoặc optionId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(optionId)) {
      return res.status(400).json({ error: 'productId hoặc optionId không hợp lệ' });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Số lượng phải là số nguyên lớn hơn hoặc bằng 1' });
    }

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Tìm sản phẩm và kiểm tra option
    const Product = mongoose.model('Product');
    const product = await Product.findById(productId).lean(); // Sử dụng lean() để lấy dữ liệu thô
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    console.log('Product options:', product.option); // Debug: Xem mảng option
    const option = product.option.find(opt => opt._id && opt._id.toString() === optionId);
    if (!option) {
      console.log(`Option not found for optionId: ${optionId}, available options:`, product.option.map(opt => opt._id));
      return res.status(404).json({ error: 'Biến thể sản phẩm không tồn tại' });
    }

    if (option.stock < quantity) {
      return res.status(400).json({ error: `Biến thể ${option.value} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu` });
    }

    // Tìm giỏ hàng
    const Cart = mongoose.model('Cart');
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name images option'
    });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    // Debug: Log dữ liệu yêu cầu và cart.items
    const requestData = { productId, optionId, quantity };
    console.log('Request data:', requestData);
    console.log('Cart items:', cart.items.map(item => ({
      productId: item.product ? item.product._id.toString() : null,
      optionId: item.optionId ? item.optionId.toString() : null,
      quantity: item.quantity
    })));

    // Tìm và cập nhật item trong giỏ hàng
    const itemIndex = cart.items.findIndex(
      (item) => {
        if (!item.product || !item.optionId) {
          console.log(`Invalid item skipped: product=${item.product}, optionId=${item.optionId}`);
          return false;
        }
        const matchProduct = item.product._id.toString() === productId;
        const matchOption = item.optionId.toString() === optionId;
        console.log(`Checking item - productId: ${item.product._id.toString()}, optionId: ${item.optionId.toString()}, matchProduct: ${matchProduct}, matchOption: ${matchOption}`);
        return matchProduct && matchOption;
      }
    );

    if (itemIndex === -1) {
      console.log(`No match found for productId: ${productId}, optionId: ${optionId}`);
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    // Cập nhật số lượng
    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    // Populate lại dữ liệu sản phẩm sau khi cập nhật
    await cart.populate({
      path: 'items.product',
      select: 'name images option'
    });

    res.json(cart);
  } catch (error) {
    console.error('Lỗi cập nhật số lượng:', error.stack);
    res.status(500).json({ error: 'Lỗi cập nhật số lượng', details: error.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { cartId, productId, optionId } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    if (!cartId || !productId || !optionId) {
      return res.status(400).json({ error: 'Thiếu cartId, productId hoặc optionId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(cartId) || !mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(optionId)) {
      return res.status(400).json({ error: 'cartId, productId hoặc optionId không hợp lệ' });
    }

    const cart = await Cart.findOne({ _id: cartId, user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng hoặc giỏ hàng không thuộc về người dùng' });
    }

    const itemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId && item.optionId.toString() === optionId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate({
      path: 'items.product',
      select: 'name images option'
    });
    res.json(cart);
  } catch (error) {
    console.error('Lỗi xóa sản phẩm khỏi giỏ:', error.stack);
    res.status(500).json({ error: 'Lỗi xóa sản phẩm khỏi giỏ', details: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = [];
    await cart.save();

    res.json({ message: 'Đã xóa toàn bộ giỏ hàng' });
  } catch (error) {
    console.error('Lỗi khi xóa giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi xóa giỏ hàng', details: error.message });
  }
};

exports.checkout = async (req, res) => {
  try {
    const { userId, addressLine, ward, district, cityOrProvince, sdt, paymentMethod, note, couponCode } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    if (!addressLine || !ward || !district || !cityOrProvince) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp đầy đủ thông tin địa chỉ (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố)',
      });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!sdt || !phoneRegex.test(sdt)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số.' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Vui lòng cung cấp phương thức thanh toán' });
    }

    // Kiểm tra phương thức thanh toán hợp lệ
    const validPaymentMethods = ['cod', 'vnpay', 'bank'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ. Chỉ hỗ trợ "cod", "vnpay" hoặc "bank".' });
    }

    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Lấy giỏ hàng và populate sản phẩm
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name images option'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    // Lọc các mục hợp lệ và không hợp lệ
    const invalidItems = cart.items.filter(item => !item.product || !item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));
    const validItems = cart.items.filter(item => item.product && item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng không chứa sản phẩm hợp lệ nào để thanh toán' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    // Kiểm tra số lượng tồn kho
    for (const item of validItems) {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      if (option.stock < item.quantity) {
        return res.status(400).json({
          error: `Biến thể ${option.value} của sản phẩm ${item.product.name || item.product._id} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu`,
        });
      }
    }

    // Tính tổng tiền
    let subtotal = validItems.reduce((acc, item) => {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      const price = option.discount_price > 0 ? option.discount_price : option.price;
      return acc + price * item.quantity;
    }, 0);

    let discount = 0;
    let appliedCoupon = null;

    // Xử lý mã giảm giá
    if (couponCode) {
      console.log('Coupon code received:', couponCode);
      const coupon = await Coupon.findOne({ code: { $regex: `^${couponCode}$`, $options: 'i' } });
      if (!coupon) {
        return res.status(400).json({ error: 'Mã giảm giá không tồn tại' });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ error: 'Mã giảm giá không còn hoạt động' });
      }

      if (coupon.expiryDate && new Date() > coupon.expiryDate) {
        return res.status(400).json({ error: 'Mã giảm giá đã hết hạn' });
      }

      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          error: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã này`,
        });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
      }

      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed') {
        discount = coupon.discountValue;
      }

      discount = Math.min(discount, subtotal);
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      appliedCoupon = coupon;
    }

    const total = subtotal - discount;

    // Tạo paymentCode duy nhất
    const paymentCode = `thanhtoan${Math.floor(10000 + Math.random() * 90000)}`;

    // Tạo địa chỉ từ yêu cầu
    const newAddress = {
      addressLine,
      ward,
      district,
      cityOrProvince
    };

    // Kiểm tra xem địa chỉ có trùng với temporaryAddress1 hoặc temporaryAddress2
    const isExistingAddress = (
      (user.temporaryAddress1.addressLine === addressLine &&
       user.temporaryAddress1.ward === ward &&
       user.temporaryAddress1.district === district &&
       user.temporaryAddress1.cityOrProvince === cityOrProvince) ||
      (user.temporaryAddress2.addressLine === addressLine &&
       user.temporaryAddress2.ward === ward &&
       user.temporaryAddress2.district === district &&
       user.temporaryAddress2.cityOrProvince === cityOrProvince)
    );

    // Tạo đơn hàng
    const order = {
      user: userId,
      items: validItems.map(item => ({
        product: item.product._id,
        optionId: item.optionId,
        quantity: item.quantity,
        images: item.product.images || [],
      })),
      subtotal,
      discount,
      total,
      address: newAddress,
      sdt,
      paymentMethod,
      note,
      coupon: appliedCoupon ? appliedCoupon._id : null,
      paymentStatus: 'pending',
      shippingStatus: 'pending',
    };

    const newOrder = await Order.create(order);

    // Cập nhật temporaryAddress nếu địa chỉ là mới
    if (!isExistingAddress) {
      user.temporaryAddress2 = { ...user.temporaryAddress1 };
      user.temporaryAddress1 = newAddress;
      user.listOrder.push(newOrder._id);
      await user.save();
    } else {
      user.listOrder.push(newOrder._id);
      await user.save();
    }

    // Cập nhật số lượng tồn kho
    for (const item of validItems) {
      const product = await Product.findById(item.product._id);
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      option.stock -= item.quantity;
      await product.save();
    }

    // Xử lý thanh toán qua VNPay nếu phương thức là 'vnpay'
    let paymentUrl = null;
    if (paymentMethod === 'vnpay') {
      try {
        const paymentResponse = await VnpayController.createPayment({
          ...req,
          body: { amount: total, orderId: newOrder._id }
        });
        if (paymentResponse.status === 'success') {
          paymentUrl = paymentResponse.data.paymentUrl;
        } else {
          throw new Error(paymentResponse.message || 'Lỗi khi tạo URL thanh toán VNPay');
        }
      } catch (error) {
        console.error('Lỗi khi tạo thanh toán VNPay:', error.stack);
        return res.status(500).json({ error: 'Lỗi khi tạo thanh toán VNPay', details: error.message });
      }
    }

    // Gửi email xác nhận đơn hàng
    try {
      const authHeader = req.headers.authorization;
      console.log('Authorization header:', authHeader);

      if (!authHeader) {
        console.warn('Không tìm thấy authorization header khi gửi email');
      }

      const itemsHtml = validItems.map(item => {
        const product = item.product;
        const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
        const price = option.discount_price > 0 ? option.discount_price : option.price;
        return `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0;">
              <img src="${product.images[0] || 'https://via.placeholder.com/50'}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
            </td>
            <td style="padding: 10px 0; color: #333; font-size: 14px;">${product.name} (${option.value})</td>
            <td style="padding: 10px 0; color: #333; font-size: 14px; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px 0; color: #333; font-size: 14px; text-align: right;">${(price * item.quantity).toLocaleString('vi-VN')} VNĐ</td>
          </tr>
        `;
      }).join('');

      const emailHeaders = {
        'Content-Type': 'application/json'
      };

      if (authHeader) {
        emailHeaders['Authorization'] = authHeader;
      }

      const paymentMethodDisplay = paymentMethod === 'vnpay' ? 'VNPay' : 
                                  paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 
                                  'Chuyển khoản ngân hàng';

      const emailResponse = await axios.post('http://localhost:10000/api/email/sendEmail', {
        username: user.username,
        email: user.email,
        subject: `Xác nhận đơn hàng #${newOrder._id} từ Pure-Botanica 🌿`,
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 0;">
            <div style="text-align: center; background-color: #357E38; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Xác nhận đơn hàng</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
              <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px;">Xin chào ${user.username},</h3>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Cảm ơn bạn đã mua sắm tại <strong>Pure-Botanica</strong>! Đơn hàng #${newOrder._id} của bạn đã được đặt thành công. Dưới đây là chi tiết đơn hàng:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; color: #333; font-size: 14px; text-align: left;">Hình ảnh</th>
                    <th style="padding: 10px; color: #333; font-size: 14px; text-align: left;">Sản phẩm</th>
                    <th style="padding: 10px; color: #333; font-size: 14px; text-align: center;">Số lượng</th>
                    <th style="padding: 10px; color: #333; font-size: 14px; text-align: right;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 10px;">
                <strong>Tổng phụ:</strong> ${subtotal.toLocaleString('vi-VN')} VNĐ
              </p>
              ${discount > 0 ? `
                <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 10px;">
                  <strong>Giảm giá (${couponCode}):</strong> -${discount.toLocaleString('vi-VN')} VNĐ
                </p>
              ` : ''}
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Tổng cộng:</strong> ${total.toLocaleString('vi-VN')} VNĐ
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Mã thanh toán:</strong> ${paymentCode}
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Địa chỉ giao hàng:</strong> ${addressLine}, ${ward}, ${district}, ${cityOrProvince}
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Số điện thoại:</strong> ${sdt}
              </p>
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Phương thức thanh toán:</strong> ${paymentMethodDisplay}
              </p>
              ${paymentUrl && paymentMethod === 'vnpay' ? `
                <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                  <strong>Link thanh toán:</strong> <a href="${paymentUrl}" style="color: #357E38; text-decoration: none;">Nhấn để thanh toán qua VNPay</a>
                </p>
              ` : ''}
              ${note ? `
                <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                  <strong>Ghi chú:</strong> ${note}
                </p>
              ` : ''}
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://purebotanica.online/orders/${newOrder._id}" style="display: inline-block; background-color: #357E38; color: #ffffff; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-size: 16px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Theo dõi đơn hàng</a>
              </div>
              <p style="color: #777; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
                Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a>.
              </p>
            </div>
            <div style="text-align: center; padding: 20px 0; color: #666; font-size: 12px;">
              <p style="margin: 0 0 10px;">Theo dõi chúng tôi:</p>
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/facebook-new.png" alt="Facebook" style="width: 24px; height: 24px;">
                </a>
                <a href="https://instagram.com/purebotanica" style="margin: 0 5px;">
                  <img src="https://img.icons8.com/color/24/000000/instagram-new.png" alt="Instagram" style="width: 24px; height: 24px;">
                </a>
              </div>
              <p style="margin: 0 0 5px;">© 2025 Pure-Botanica. All rights reserved.</p>
              <p style="margin: 0;">
                Liên hệ: <a href="mailto:purebotanicastore@gmail.com" style="color: #357E38; text-decoration: none;">purebotanicastore@gmail.com</a> | 
                <a href="https://purebotanica.online" style="color: #357E38; text-decoration: none;">purebotanica.com</a>
              </p>
            </div>
          </div>
        `,
      }, {
        headers: emailHeaders
      });

      console.log(`Đã gửi email xác nhận đơn hàng tới: ${user.email}`);
    } catch (emailError) {
      console.error(`Lỗi gửi email xác nhận đơn hàng cho ${user.email}:`, emailError.message);
      if (emailError.response) {
        console.error('Response status:', emailError.response.status);
        console.error('Response data:', emailError.response.data);
        console.error('Response headers:', emailError.response.headers);
      } else if (emailError.request) {
        console.error('Request made but no response received:', emailError.request);
      } else {
        console.error('Error setting up request:', emailError.message);
      }
    }

    // Xóa giỏ hàng sau khi thanh toán
    cart.items = [];
    await cart.save();

    // Populate dữ liệu cho phản hồi
    await newOrder.populate([
      { path: 'items.product' },
      { path: 'user', select: 'username email' },
      { path: 'coupon' }
    ]);

    // Trả về phản hồi với paymentCode và paymentUrl (nếu có)
    res.json({
      message: 'Thanh toán thành công',
      order: newOrder,
      paymentCode,
      paymentUrl: paymentUrl || undefined,
      warning: invalidItems.length > 0
        ? `Đã loại bỏ ${invalidItems.length} sản phẩm không hợp lệ khỏi giỏ hàng`
        : undefined,
    });
  } catch (error) {
    console.error('Lỗi khi thanh toán:', error.stack);
    res.status(500).json({ error: 'Lỗi khi thanh toán', details: error.message });
  }
};

exports.updatePrice = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { couponCode } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name images option'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ success: false, error: 'Giỏ hàng trống' });
    }

    // Filter valid and invalid items
    const invalidItems = cart.items.filter(item => !item.product || !item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));
    const validItems = cart.items.filter(item => item.product && item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));

    if (validItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Giỏ hàng không chứa sản phẩm hợp lệ' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    // Calculate subtotal
    let subtotal = validItems.reduce((acc, item) => {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      const price = option.discount_price > 0 ? option.discount_price : option.price;
      return acc + price * item.quantity;
    }, 0);

    let discount = 0;
    let message = 'Giá đã được cập nhật';

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: { $regex: `^${couponCode}$`, $options: 'i' } });
      if (!coupon) {
        return res.status(400).json({ success: false, error: 'Mã giảm giá không tồn tại' });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ success: false, error: 'Mã giảm giá không còn hoạt động' });
      }

      if (coupon.expiryDate && new Date() > coupon.expiryDate) {
        return res.status(400).json({ success: false, error: 'Mã giảm giá đã hết hạn' });
      }

      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        return res.status(400).json({ success: false, error: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã này` });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, error: 'Mã giảm giá đã đạt giới hạn sử dụng' });
      }

      // Apply discount
      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed') {
        discount = coupon.discountValue;
      }

      discount = Math.min(discount, subtotal); // Ensure discount doesn't exceed subtotal
      message = 'Mã giảm giá đã được áp dụng thành công';
      // Optionally increment usedCount if needed (uncomment if required)
      // await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }

    const total = subtotal - discount;

    res.json({
      success: true,
      message,
      subtotal,
      discount,
      total,
      cart: {
        _id: cart._id,
        items: validItems,
      }
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật giá:', error.stack);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật giá', details: error.message });
  }
};

module.exports = {
  getCartItems: exports.getCartItems,
  addToCart: exports.addToCart,
  updateQuantity: exports.updateQuantity,
  removeItem: exports.removeItem,
  clearCart: exports.clearCart,
  checkout: exports.checkout,
  updatePrice: exports.updatePrice,
  getAllCarts: exports.getAllCarts
};