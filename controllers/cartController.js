const Cart = require('../models/cart');
const Product = require('../models/product');
const Users = require('../models/user');
const Order = require('../models/order');
const Coupon = require('../models/coupon');
const mongoose = require('mongoose');

exports.getCartItems = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name price stock images');

    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    res.json({
      _id: cart._id,
      user: cart.user,
      items: cart.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        images: item.product?.images || []
      }))
    });
  } catch (error) {
    console.error('Lỗi khi lấy giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi khi lấy giỏ hàng', details: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId, quantity = 1 } = req.body;

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

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải là số nguyên lớn hơn 0' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: `Sản phẩm chỉ còn ${product.stock} trong kho, không đủ số lượng yêu cầu` });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(400).json({ error: `Sản phẩm chỉ còn ${product.stock} trong kho, không đủ số lượng yêu cầu` });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    await cart.populate('items.product', 'name price stock images');
    res.json(cart);
  } catch (error) {
    console.error('Lỗi thêm sản phẩm vào giỏ hàng:', error.stack);
    res.status(500).json({ error: 'Lỗi thêm sản phẩm vào giỏ hàng', details: error.message });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId, quantity } = req.body;

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

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải là số nguyên lớn hơn 0' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: `Sản phẩm chỉ còn ${product.stock} trong kho, không đủ số lượng yêu cầu` });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    item.quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name price stock images');

    res.json(cart);
  } catch (error) {
    console.error('Lỗi cập nhật số lượng:', error.stack);
    res.status(500).json({ error: 'Lỗi cập nhật số lượng', details: error.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId } = req.params;

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

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.product', 'name price stock images');

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

    const user = await Users.findById(userId);
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
    const { userId, addressLine, ward, district, cityOrProvince, sdt, paymentMethod, note, productDetails, couponCode } = req.body;

    // Kiểm tra userId
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    // Kiểm tra địa chỉ chi tiết
    if (!addressLine || !ward || !district || !cityOrProvince) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp đầy đủ thông tin địa chỉ (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố)',
      });
    }

    // Kiểm tra số điện thoại
    if (!sdt) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại' });
    }

    // Kiểm tra định dạng số điện thoại (ví dụ: 10 chữ số, chỉ chứa số)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(sdt)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số.' });
    }

    // Kiểm tra phương thức thanh toán
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Vui lòng cung cấp phương thức thanh toán' });
    }

    // Kiểm tra người dùng
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Kiểm tra giỏ hàng
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    const invalidItems = cart.items.filter((item) => !item.product);
    const validItems = cart.items.filter((item) => item.product);

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng không chứa sản phẩm hợp lệ nào để thanh toán' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    // Kiểm tra tồn kho
    for (const item of validItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `Sản phẩm ${item.product.name || item.product._id} chỉ còn ${item.product.stock} trong kho, không đủ số lượng yêu cầu`,
        });
      }
    }

    // Tính toán tổng tiền
    let subtotal = validItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
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

      // Tính toán giảm giá
      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed') {
        discount = coupon.discountValue;
      }

      // Đảm bảo giảm giá không vượt quá tổng tiền
      discount = Math.min(discount, subtotal);

      // Cập nhật số lần sử dụng mã giảm giá
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      appliedCoupon = coupon;
    }

    const total = subtotal - discount;

    // Tạo đơn hàng với địa chỉ chi tiết dưới dạng chuỗi
    const order = {
      user: userId,
      items: validItems.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
        images: item.product.images || [],
      })),
      subtotal,
      discount,
      total,
      address: {
        addressLine,  // Số nhà, đường
        ward,
        district,
        cityOrProvince,  // Tỉnh/Thành phố
      },
      sdt,
      paymentMethod,
      note,
      productDetails,
      coupon: appliedCoupon ? appliedCoupon._id : null,
      paymentStatus: 'pending',
    };

    const newOrder = await Order.create(order);

    // Cập nhật số lượng tồn kho
    for (const item of validItems) {
      item.product.stock -= item.quantity;
      await item.product.save();
    }

    // Populate thông tin đơn hàng
    await newOrder.populate([
      { path: 'items.product' },
      { path: 'user', select: 'username email' },
      { path: 'coupon' },
    ]);

    // Xóa giỏ hàng
    cart.items = [];
    await cart.save();

    // Trả về phản hồi
    res.json({
      message: 'Thanh toán thành công',
      order: newOrder,
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

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ error: 'Giỏ hàng trống' });
    }

    const invalidItems = cart.items.filter((item) => !item.product);
    const validItems = cart.items.filter((item) => item.product);

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng không chứa sản phẩm hợp lệ' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    let subtotal = validItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    let discount = 0;

    if (couponCode) {
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
        return res.status(400).json({ error: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã này` });
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
    }

    const total = subtotal - discount;

    res.json({
      subtotal,
      discount,
      total
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật giá:', error.stack);
    res.status(500).json({ error: 'Lỗi khi cập nhật giá', details: error.message });
  }
};

module.exports = {
  getCartItems: exports.getCartItems,
  addToCart: exports.addToCart,
  updateQuantity: exports.updateQuantity,
  removeItem: exports.removeItem,
  clearCart: exports.clearCart,
  checkout: exports.checkout,
  updatePrice: exports.updatePrice
};