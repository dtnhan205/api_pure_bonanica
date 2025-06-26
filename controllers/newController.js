const mongoose = require('mongoose');
const News = require('../models/news');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');

// Hàm tạo slug duy nhất
const generateSlug = async (title, currentNewsId = null) => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  let uniqueSlug = baseSlug;
  const regex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i');
  const existingSlugs = await News.find(
    { slug: regex, _id: { $ne: currentNewsId } },
    'slug'
  ).lean();

  if (existingSlugs.length === 0) {
    console.log(`Generated unique slug for "${title}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  if (!existingSlugs.some(doc => doc.slug === baseSlug)) {
    console.log(`Generated unique slug for "${title}": ${uniqueSlug}`);
    return uniqueSlug;
  }

  const numbers = existingSlugs
    .map(doc => {
      const match = doc.slug.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => !isNaN(num));

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  uniqueSlug = `${baseSlug}-${maxNumber + 1}`;

  console.log(`Generated unique slug for "${title}": ${uniqueSlug}`);
  return uniqueSlug;
};

// Middleware kiểm tra quyền admin
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token, quyền truy cập bị từ chối' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(403).json({ error: 'Không có quyền admin' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

exports.getAllNews = async (req, res) => {
  try {
    const newsList = await News.find().sort({ publishedAt: -1 });
    if (newsList.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tin tức nào' });
    }
    res.json(newsList);
  } catch (error) {
    console.error('GET /api/news error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy tin tức', error: error.message });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isAdmin = !!req.headers.authorization;
    let news;

    // Kiểm tra xem identifier có phải là ObjectId hợp lệ
    const isObjectId = mongoose.isValidObjectId(identifier);

    if (isAdmin) {
      // Admin: Không tăng views
      news = isObjectId
        ? await News.findById(identifier)
        : await News.findOne({ slug: identifier });
    } else {
      // Non-admin: Tăng views
      news = isObjectId
        ? await News.findByIdAndUpdate(
            identifier,
            { $inc: { views: 1 } },
            { new: true }
          )
        : await News.findOneAndUpdate(
            { slug: identifier },
            { $inc: { views: 1 } },
            { new: true }
          );
    }

    if (!news) {
      return res.status(404).json({ message: 'Không tìm thấy tin tức' });
    }
    res.json(news);
  } catch (error) {
    console.error(`GET /api/news/${req.params.identifier} error:`, error);
    res.status(500).json({ message: 'Lỗi server khi lấy tin tức', error: error.message });
  }
};

exports.getHottestNews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    let query = News.find({ status: 'show' }).sort({ views: -1 });
    if (limit > 0) {
      query = query.limit(limit);
    }
    const hottestNewsList = await query;
    if (hottestNewsList.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy bài đăng nào' });
    }
    res.json({
      message: 'Lấy danh sách bài đăng hot thành công',
      news: hottestNewsList,
    });
  } catch (error) {
    console.error('GET /api/news/hottest error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài đăng hot', error: error.message });
  }
};

exports.createNews = async (req, res) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? JSON.stringify(req.files, null, 2) : 'No files');

    const { title, slug, thumbnailCaption, publishedAt, views, status, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc: title, content' });
    }

    const thumbnail = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
    if (!thumbnail) {
      return res.status(400).json({ error: 'Không tìm thấy file thumbnail' });
    }
    const thumbnailUrl = `/images/${thumbnail.filename}`;

    const finalSlug = slug || (await generateSlug(title));

    const slugExists = await News.findOne({ slug: finalSlug });
    if (slugExists) {
      return res.status(400).json({ error: `Slug "${finalSlug}" đã tồn tại` });
    }

    const newNews = new News({
      title,
      slug: finalSlug,
      thumbnailUrl,
      thumbnailCaption: thumbnailCaption || '',
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      views: parseInt(views, 10) || 0,
      status: status || 'show',
      content,
    });

    await newNews.save();
    res.status(201).json({
      message: 'Tạo tin tức thành công',
      news: newNews,
    });
  } catch (err) {
    console.error('POST /api/news error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Trùng lặp slug' });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Received files:', req.files ? JSON.stringify(req.files, null, 2) : 'No files');

    const { title, slug, thumbnailCaption, publishedAt, views, status, content } = req.body;

    const files = req.files || {};
    const thumbnail = files['thumbnail'] && files['thumbnail'].length > 0 ? files['thumbnail'][0] : null;

    const updateData = {
      title,
      slug: slug ? await generateSlug(slug, isObjectId ? identifier : null) : undefined,
      thumbnailUrl: thumbnail ? `/images/${thumbnail.filename}` : undefined,
      thumbnailCaption: thumbnailCaption || undefined,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      views: parseInt(views, 10) || undefined,
      status: status || undefined,
      content,
    };

    // Loại bỏ các trường undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedNews = await News.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedNews) {
      return res.status(404).json({ error: 'Không tìm thấy tin tức để cập nhật' });
    }

    res.json({
      message: 'Cập nhật tin tức thành công',
      news: updatedNews,
    });
  } catch (err) {
    console.error(`PUT /api/news/${req.params.identifier} error:`, err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Trùng lặp slug' });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const deletedNews = await News.findOneAndDelete(query);
    if (!deletedNews) {
      return res.status(404).json({ message: 'Không tìm thấy tin tức để xóa' });
    }
    res.json({ message: 'Xóa tin tức thành công' });
  } catch (err) {
    console.error(`DELETE /api/news/${req.params.identifier} error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

exports.toggleNewsVisibility = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.isValidObjectId(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    const news = await News.findOne(query);
    if (!news) {
      return res.status(404).json({ message: 'Không tìm thấy tin tức' });
    }

    news.status = news.status === 'show' ? 'hidden' : 'show';
    await news.save();

    res.json({
      message: `Tin tức đã được ${news.status === 'show' ? 'hiển thị' : 'ẩn'}`,
      news,
    });
  } catch (err) {
    console.error(`PUT /api/news/${req.params.identifier}/toggle-visibility error:`, err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};

module.exports = {
  getAllNews: exports.getAllNews,
  getNewsById: exports.getNewsById,
  getHottestNews: exports.getHottestNews,
  createNews: exports.createNews,
  updateNews: exports.updateNews,
  deleteNews: exports.deleteNews,
  toggleNewsVisibility: exports.toggleNewsVisibility,
  verifyAdmin,
};