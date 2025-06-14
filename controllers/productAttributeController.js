const mongoose = require('mongoose');
const ProductAttribute = require('../models/productAttribute');

// Get all product attributes
exports.getAllProductAttributes = async (req, res) => {
  try {
    const productAttributes = await ProductAttribute.find();
    if (!productAttributes.length) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính sản phẩm nào' });
    }
    res.json(productAttributes);
  } catch (err) {
    console.error('GET /api/product-attributes error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get product attribute by ID
exports.getProductAttributeById = async (req, res) => {
  const { id } = req.params;

  try {
    const productAttribute = await ProductAttribute.findOne({ _id: id });
    if (!productAttribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính sản phẩm' });
    }
    res.json(productAttribute);
  } catch (err) {
    console.error(`GET /api/product-attributes/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Create a new product attribute
exports.createProductAttribute = async (req, res) => {
  try {
    const { id_product, id_attribute, value, Price, SalePrice, Stock } = req.body;

    const newProductAttribute = new ProductAttribute({
      _id: req.body._id || new mongoose.Types.ObjectId(),
      id_product,
      id_attribute,
      value,
      Price,
      SalePrice,
      Stock,
    });

    await newProductAttribute.save();
    res.status(201).json({
      message: 'Tạo thuộc tính sản phẩm thành công',
      productAttribute: newProductAttribute,
    });
  } catch (err) {
    console.error('POST /api/product-attributes error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Update a product attribute by ID
exports.updateProductAttribute = async (req, res) => {
  const { id } = req.params;

  try {
    const { id_product, id_attribute, value, Price, SalePrice, Stock } = req.body;

    const updatedProductAttribute = await ProductAttribute.findByIdAndUpdate(
      id,
      { id_product, id_attribute, value, Price, SalePrice, Stock },
      { new: true, runValidators: true }
    );

    if (!updatedProductAttribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính sản phẩm để cập nhật' });
    }

    res.json({
      message: 'Cập nhật thuộc tính sản phẩm thành công',
      productAttribute: updatedProductAttribute,
    });
  } catch (err) {
    console.error(`PUT /api/product-attributes/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
};

// Delete a product attribute by ID
exports.deleteProductAttribute = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProductAttribute = await ProductAttribute.findByIdAndDelete(id);
    if (!deletedProductAttribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính sản phẩm để xóa' });
    }
    res.json({ message: 'Xóa thuộc tính sản phẩm thành công' });
  } catch (err) {
    console.error(`DELETE /api/product-attributes/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};