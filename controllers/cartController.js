const mongoose = require('mongoose');
const Cart = require('../models/cart');
const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order');
const Coupon = require('../models/coupon');


exports.getAllCarts = async (req, res) => {
  try {
    // Lấy tất cả giỏ hàng và populate thông tin người dùng và sản phẩm
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

    // Format dữ liệu trả về
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
    const userId = req.query.userId || req.body.userId;
    const { productId, optionId, quantity } = req.body;

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

    const option = product.option.find(opt => opt._id.toString() === optionId.toString());
    if (!option) {
      return res.status(404).json({ error: 'Biến thể sản phẩm không tồn tại' });
    }

    if (option.stock < quantity) {
      return res.status(400).json({ error: `Biến thể ${option.value} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu` });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    const item = cart.items.find(item => 
      item.product.toString() === productId && item.optionId.toString() === optionId
    );

    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });
    }

    item.quantity = quantity;
    await cart.save();
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

    // Find the cart by cartId and verify it belongs to the user
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
    const { userId, addressLine, ward, district, cityOrProvince, sdt, paymentMethod, note } = req.body;

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name images option'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

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

    for (const item of validItems) {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      if (option.stock < item.quantity) {
        return res.status(400).json({
          error: `Biến thể ${option.value} của sản phẩm ${item.product.name || item.product._id} chỉ còn ${option.stock} trong kho, không đủ số lượng yêu cầu`,
        });
      }
    }

    let subtotal = validItems.reduce((acc, item) => {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      const price = option.discount_price > 0 ? option.discount_price : option.price;
      return acc + price * item.quantity;
    }, 0);

    let discount = 0;
    let appliedCoupon = null;

    if (req.body.couponCode) {
      console.log('Coupon code received:', req.body.couponCode);
      const coupon = await Coupon.findOne({ code: { $regex: `^${req.body.couponCode}$`, $options: 'i' } });
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
      address: {
        addressLine,
        ward,
        district,
        cityOrProvince,
      },
      sdt,
      paymentMethod,
      note,
      coupon: appliedCoupon ? appliedCoupon._id : null,
      paymentStatus: 'pending',
    };

    const newOrder = await Order.create(order);

    for (const item of validItems) {
      const product = await Product.findById(item.product._id);
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      option.stock -= item.quantity;
      await product.save();
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name images option'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ error: 'Giỏ hàng trống' });
    }

    const invalidItems = cart.items.filter(item => !item.product || !item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));
    const validItems = cart.items.filter(item => item.product && item.product.option.find(opt => opt._id.toString() === item.optionId.toString()));

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng không chứa sản phẩm hợp lệ' });
    }

    if (invalidItems.length > 0) {
      console.log('Invalid items removed from cart:', invalidItems);
      cart.items = validItems;
      await cart.save();
    }

    let subtotal = validItems.reduce((acc, item) => {
      const product = item.product;
      const option = product.option.find(opt => opt._id.toString() === item.optionId.toString());
      const price = option.discount_price > 0 ? option.discount_price : option.price;
      return acc + price * item.quantity;
    }, 0);

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
  updatePrice: exports.updatePrice,
  getAllCarts: exports.getAllCarts
};