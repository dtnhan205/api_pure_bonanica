const Product = require('../models/product');
const mongoose = require('mongoose');

exports.createProduct = async (req, res, next) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, filename: f.filename })) : 'No files');

    const { 
      name, slug, status, view, id_brand, id_category, 
      short_description, description, usage_instructions, 
      ingredients, warning, product_uses 
    } = req.body;

    const parseArray = (data) => {
      if (!data) return [];
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          console.warn(`Failed to parse JSON for ${data}:`, e.message);
          return data.split(',').map(item => item.trim());
        }
      }
      return Array.isArray(data) ? data : [data];
    };

    if (!name || !slug || !id_brand || !id_category) {
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc: name, slug, id_brand, id_category' });
    }

    if (!mongoose.isValidObjectId(id_brand) || !mongoose.isValidObjectId(id_category)) {
      return res.status(400).json({ error: 'id_brand hoặc id_category không hợp lệ' });
    }

    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({ error: 'Slug đã tồn tại, vui lòng chọn slug khác' });
    }

    const imagePaths = req.files ? req.files.map(file => `/images/${file.filename}`) : [];

    const product = new Product({
      name,
      slug,
      status: status || 'show',
      view: view || 0,
      id_brand,
      id_category,
      images: imagePaths,
      short_description: parseArray(short_description),
      description: parseArray(description),
      usage_instructions: parseArray(usage_instructions),
      ingredients: parseArray(ingredients),
      warning: parseArray(warning),
      product_uses: parseArray(product_uses),
    });

    await product.save();
    res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
  } catch (err) {
    console.error('Lỗi tạo sản phẩm:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'show' }).select('-__v').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.getProductBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const product = await Product.findOne({ slug, status: 'show' }).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json(product);
  } catch (err) {
    console.error('Lỗi lấy sản phẩm theo slug:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.updateProduct = async (req, res, next) => {
  upload.array('images', 10)(req, res, async (err) => {
    if (err) return handleMulterError(err, req, res, next);

    try {
      const { slug } = req.params;
      const { id_brand, id_category, ...updateData } = req.body;

      // Parse các trường là JSON hoặc chuỗi
      const parseArray = (data) => {
        if (!data) return [];
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            return data.split(',').map(item => item.trim());
          }
        }
        return Array.isArray(data) ? data : [data];
      };

      if (!slug) {
        return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
      }

      if (id_brand && !mongoose.isValidObjectId(id_brand)) {
        return res.status(400).json({ error: 'id_brand không hợp lệ' });
      }
      if (id_category && !mongoose.isValidObjectId(id_category)) {
        return res.status(400).json({ error: 'id_category không hợp lệ' });
      }

      if (updateData.slug) {
        const existingSlug = await Product.findOne({ slug: updateData.slug, slug: { $ne: slug } });
        if (existingSlug) {
          return res.status(400).json({ error: 'Slug đã tồn tại, vui lòng chọn slug khác' });
        }
      }

      // Thêm hình ảnh mới (nếu có)
      if (req.files && req.files.length > 0) {
        updateData.images = req.files.map(file => `/images/${file.filename}`);
      }

      // Parse các trường mảng
      if (updateData.short_description) updateData.short_description = parseArray(updateData.short_description);
      if (updateData.description) updateData.description = parseArray(updateData.description);
      if (updateData.usage_instructions) updateData.usage_instructions = parseArray(updateData.usage_instructions);
      if (updateData.ingredients) updateData.ingredients = parseArray(updateData.ingredients);
      if (updateData.warning) updateData.warning = parseArray(updateData.warning);
      if (updateData.product_uses) updateData.product_uses = parseArray(updateData.product_uses);

      const updatedProduct = await Product.findOneAndUpdate(
        { slug },
        { $set: updateData },
        { new: true, runValidators: true, select: '-__v' }
      );

      if (!updatedProduct) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
      }
      res.json({ message: 'Cập nhật thành công', product: updatedProduct });
    } catch (err) {
      console.error('Lỗi cập nhật sản phẩm:', err);
      res.status(400).json({ error: err.message });
    }
  });
};

exports.deleteProduct = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const deletedProduct = await Product.findOneAndDelete({ slug });
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (err) {
    console.error('Lỗi xóa sản phẩm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.toggleProductVisibility = async (req, res) => {
  const { slug } = req.params;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Slug sản phẩm không hợp lệ' });
    }

    const product = await Product.findOne({ slug }).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    product.status = product.status === 'show' ? 'hidden' : 'show';
    await product.save();

    res.json({ message: `Trạng thái sản phẩm đã chuyển thành ${product.status}`, product });
  } catch (err) {
    console.error('Lỗi toggle visibility:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};