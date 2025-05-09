const Cart = require('../models/cart');
const Product = require('../models/product');
const Users = require('../models/user'); // Đổi tên biến thành Users để rõ ràng
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

    const user = await Users.findById(userId); // Cập nhật thành Users
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name price stock images'); // Thêm images vào populate

    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    res.json({  
      _id: cart._id,
      user: cart.user,
      items: cart.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        images: item.product.images || []  // Đảm bảo rằng nếu không có hình ảnh, trả về mảng rỗng
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

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải lớn hơn 0' });
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
    await cart.populate('items.product');
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

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải lớn hơn 0' });
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
    await cart.populate('items.product');

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

    const user = await Users.findById(userId); // Cập nhật thành Users
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();
    await cart.populate('items.product');

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
    const { userId, address, sdt, paymentMethod, note, productDetails, couponCode } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'userId không hợp lệ' });
    }

    if (!address) {
      return res.status(400).json({ error: 'Vui lòng cung cấp địa chỉ' });
    }
    if (!sdt) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Vui lòng cung cấp phương thức thanh toán' });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    const invalidItems = cart.items.filter(item => !item.product);
    const validItems = cart.items.filter(item => item.product);

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng không chứa sản phẩm hợp lệ nào để thanh toán' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    for (const item of validItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ error: `Sản phẩm ${item.product.name || item.product._id} chỉ còn ${item.product.stock} trong kho, không đủ số lượng yêu cầu` });
      }
    }

    let subtotal = validItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    let discount = 0;
    let appliedCoupon = null;

    // Kiểm tra và áp dụng mã giảm giá nếu có
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
        return res.status(400).json({ error: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã này` });
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

      // Cập nhật số lần sử dụng mã giảm giá
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      appliedCoupon = coupon;
    }

    const total = subtotal - discount;

    const order = {
      user: userId,
      items: validItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        images: item.product.images
      })),
      subtotal,
      discount,
      total,
      address,
      sdt,
      paymentMethod,
      note,
      productDetails,
      coupon: appliedCoupon ? appliedCoupon._id : null,
      paymentStatus: 'pending'
    };

    const newOrder = await Order.create(order);

    for (const item of validItems) {
      item.product.stock -= item.quantity;
      await item.product.save();
    }

    await newOrder.populate([
      { path: 'items.product' },
      { path: 'user', select: 'username email' },
      { path: 'coupon' }
    ]);

    cart.items = [];
    await cart.save();

    res.json({
      message: 'Thanh toán thành công',
      order: newOrder,
      warning: invalidItems.length > 0 ? `Đã loại bỏ ${invalidItems.length} sản phẩm không hợp lệ khỏi giỏ hàng` : undefined
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

    let subtotal = cart.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
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