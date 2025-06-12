const mongoose = require('mongoose');
const Attribute = require('../models/attribute');

// Get all attributes (chỉ lấy attribute có status: 'show')
exports.getAllAttributes = async (req, res) => {
  try {
    const attributes = await Attribute.find({ status: 'show' });
    if (!attributes.length) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính nào' });
    }
    res.json(attributes);
  } catch (err) {
    console.error('GET /api/attributes error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Get attribute by ID
exports.getAttributeById = async (req, res) => {
  const { id } = req.params;

  try {
    const attribute = await Attribute.findOne({ _id: id, status: 'show' });
    if (!attribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính' });
    }
    res.json(attribute);
  } catch (err) {
    console.error(`GET /api/attributes/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Create a new attribute
exports.createAttribute = async (req, res) => {
  try {
    const { name, status } = req.body;

    const newAttribute = new Attribute({
      _id: req.body._id || new mongoose.Types.ObjectId(),
      name,
      status: status || 'show',
    });

    await newAttribute.save();
    res.status(201).json({
      message: 'Tạo thuộc tính thành công',
      attribute: newAttribute,
    });
  } catch (err) {
    console.error('POST /api/attributes error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Tên thuộc tính đã tồn tại' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Update an attribute by ID
exports.updateAttribute = async (req, res) => {
  const { id } = req.params;

  try {
    const { name, status } = req.body;

    const updatedAttribute = await Attribute.findByIdAndUpdate(
      id,
      { name, status },
      { new: true, runValidators: true }
    );

    if (!updatedAttribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính để cập nhật' });
    }

    res.json({
      message: 'Cập nhật thuộc tính thành công',
      attribute: updatedAttribute,
    });
  } catch (err) {
    console.error(`PUT /api/attributes/${id} error:`, err);
    res.status(400).json({ error: err.message });
  }
};

// Delete an attribute by ID
exports.deleteAttribute = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedAttribute = await Attribute.findByIdAndDelete(id);
    if (!deletedAttribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính để xóa' });
    }
    res.json({ message: 'Xóa thuộc tính thành công' });
  } catch (err) {
    console.error(`DELETE /api/attributes/${id} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

// Toggle attribute visibility (Chuyển đổi giữa hidden và show)
exports.toggleAttributeVisibility = async (req, res) => {
  const { id } = req.params;

  try {
    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return res.status(404).json({ message: 'Không tìm thấy thuộc tính' });
    }

    attribute.status = attribute.status === 'show' ? 'hidden' : 'show';
    await attribute.save();

    res.json({
      message: `Thuộc tính đã được ${attribute.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      attribute,
    });
  } catch (err) {
    console.error(`PUT /api/attributes/${id}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};