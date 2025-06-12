const Product = require('../models/Product');

// Tạo sản phẩm mới
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
  } catch (err) {
    console.error('Lỗi tạo sản phẩm:', err);
    res.status(400).json({ error: err.message });
  }
};

// Lấy danh sách sản phẩm (chỉ lấy status: show)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'show' }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Lấy sản phẩm theo ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findOne({ _id: id, status: 'show' });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json(product);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm theo ID:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedProduct) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json({ message: 'Cập nhật thành công', product: updatedProduct });
  } catch (err) {
    console.error('Lỗi cập nhật sản phẩm:', err);
    res.status(400).json({ error: err.message });
  }
};

// Xoá sản phẩm
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json({ message: 'Xoá sản phẩm thành công' });
  } catch (err) {
    console.error('Lỗi xoá sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Toggle status hidden/show
exports.toggleProductVisibility = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    product.status = product.status === 'show' ? 'hidden' : 'show';
    await product.save();

    res.json({ message: `Trạng thái sản phẩm đã chuyển thành ${product.status}`, product });
  } catch (err) {
    console.error('Lỗi toggle visibility:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};
