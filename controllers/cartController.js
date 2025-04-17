const Cart = require('../models/cart');
const Product = require('../models/product');

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi thêm sản phẩm vào giỏ hàng' });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ' });

    item.quantity = quantity;
    await cart.save();

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật số lượng' });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa sản phẩm khỏi giỏ' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId });

    if (!cart) return res.status(404).json({ error: 'Không tìm thấy giỏ hàng' });

    cart.items = [];
    await cart.save();

    res.json({ message: 'Đã xóa toàn bộ giỏ hàng' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa giỏ hàng' });
  }
};

exports.checkout = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    // Ở đây bạn có thể xử lý thanh toán, gửi email, lưu đơn hàng...
    // Ví dụ đơn giản:
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
    res.status(500).json({ error: 'Lỗi khi thanh toán' });
  }
};
