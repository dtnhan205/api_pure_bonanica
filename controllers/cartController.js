const Cart = require('../models/cart');
const Product = require('../models/product');
const User = require('../models/user');

exports.getCartItems = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart) {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });
    }

    res.json(cart);
  } catch (error) {
    console.error('Lỗi khi lấy giỏ hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi lấy giỏ hàng' });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      cart.items.push({ product: productId, quantity: quantity || 1 });
    }

    await cart.save();
    res.json(cart);
  } catch (error) {
    console.error('Lỗi thêm sản phẩm vào giỏ hàng:', error.message);
    res.status(500).json({ error: 'Lỗi thêm sản phẩm vào giỏ hàng' });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });

    item.quantity = quantity;
    await cart.save();

    res.json(cart);
  } catch (error) {
    console.error('Lỗi cập nhật số lượng:', error.message);
    res.status(500).json({ error: 'Lỗi cập nhật số lượng' });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    const { productId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();

    res.json(cart);
  } catch (error) {
    console.error('Lỗi xóa sản phẩm khỏi giỏ:', error.message);
    res.status(500).json({ error: 'Lỗi xóa sản phẩm khỏi giỏ' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    cart.items = [];
    await cart.save();

    res.json({ message: 'Đã xóa toàn bộ giỏ hàng' });
  } catch (error) {
    console.error('Lỗi khi xóa giỏ hàng:', error.message);
    res.status(500).json({ error: 'Lỗi khi xóa giỏ hàng' });
  }
};

exports.checkout = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId trong yêu cầu' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    const order = {
      user: userId,
      items: cart.items,
      total: cart.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
      createdAt: new Date()
    };

    cart.items = [];
    await cart.save();

    res.json({ message: 'Thanh toán thành công', order });
  } catch (error) {
    console.error('Lỗi khi thanh toán:', error.message);
    res.status(500).json({ error: 'Lỗi khi thanh toán' });
  }
};