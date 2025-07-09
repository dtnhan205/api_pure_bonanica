const mongoose = require('mongoose');
const News = require('../models/news');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

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

// Hàm kiểm tra HTML hợp lệ
const isValidHTML = (content) => {
  try {
    cheerio.load(content, { xmlMode: false, decodeEntities: false });
    return true;
  } catch (e) {
    console.error('Invalid HTML content:', e);
    return false;
  }
};

// Hàm xử lý hình ảnh nhúng trong content
const processContentImages = async (content) => {
  if (!isValidHTML(content)) {
    throw new Error('Nội dung HTML không hợp lệ');
  }

  const $ = cheerio.load(content, { xmlMode: false, decodeEntities: false });
  const imgTags = $('img');
  console.log(`Found ${imgTags.length} <img> tags in content`);

  const imagePaths = [];
  const allowedTypes = ['jpeg', 'png', 'jpg', 'gif', 'webp'];

  const promises = Array.from(imgTags).map(async (elem, i) => {
    let src = $(elem).attr('src');
    
    if (!src) {
      console.warn(`Img tag ${i + 1} has no src, skipping`);
      return;
    }

    if (src.startsWith('data:image/')) {
      try {
        const matches = src.match(/^data:image\/([a-z]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`Invalid Data URL in img tag ${i + 1}, skipping`);
          return;
        }

        const ext = matches[1].toLowerCase();
        if (!allowedTypes.includes(ext)) {
          console.warn(`Unsupported image type in Data URL (${ext}) for img tag ${i + 1}, skipping`);
          return;
        }

        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');

        if (buffer.length > 20 * 1024 * 1024) {
          console.warn(`Data URL in img tag ${i + 1} exceeds 20MB, skipping`);
          return;
        }

        const filename = `${uuidv4()}.${ext}`;
        const filePath = path.join(__dirname, '..', 'public', 'images', filename);

        await fs.writeFile(filePath, buffer);
        console.log(`Saved image from Data URL to: images/${filename}`);
        $(elem).attr('src', `images/${filename}`);
        imagePaths.push(`images/${filename}`);
      } catch (err) {
        console.error(`Error processing Data URL in img tag ${i + 1}:`, err);
      }
    } else {
      console.warn(`Img tag ${i + 1} has external or invalid src: ${src}, keeping original`);
    }
  });

  await Promise.all(promises);
  return { processedContent: $.html(), imagePaths };
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

    const isObjectId = mongoose.isValidObjectId(identifier);

    if (isAdmin) {
      news = isObjectId
        ? await News.findById(identifier)
        : await News.findOne({ slug: identifier });
    } else {
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
    const thumbnailUrl = `images/${thumbnail.filename}`;

    const { processedContent, imagePaths } = await processContentImages(content);

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
      content: processedContent,
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
    const thumbnailUrl = thumbnail ? `images/${thumbnail.filename}` : undefined;

    const { processedContent, imagePaths } = await processContentImages(content);

    const updateData = {
      title,
      slug: slug ? await generateSlug(slug, isObjectId ? identifier : null) : undefined,
      thumbnailUrl,
      thumbnailCaption: thumbnailCaption || undefined,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      views: parseInt(views, 10) || undefined,
      status: status || undefined,
      content: processedContent,
    };

    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedNews = await News.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedNews) {
      return res.status(404).json({ error: 'Không tìm thấy tin tức để cập nhật' });
    }

    // Xóa hình ảnh cũ nếu có thumbnail mới
    if (thumbnail && updatedNews.thumbnailUrl && updateData.thumbnailUrl && updatedNews.thumbnailUrl !== updateData.thumbnailUrl) {
      const oldThumbnailPath = path.join(__dirname, '..', updatedNews.thumbnailUrl);
      await fs.unlink(oldThumbnailPath).catch(err => console.error('Error deleting old thumbnail:', err));
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

    // Xóa file thumbnail
    if (deletedNews.thumbnailUrl) {
      const thumbnailPath = path.join(__dirname, '..', deletedNews.thumbnailUrl);
      await fs.unlink(thumbnailPath).catch(err => console.error('Error deleting thumbnail:', err));
    }

    // Xóa các file hình ảnh trong content
    const $ = cheerio.load(deletedNews.content);
    const deletePromises = Array.from($('img')).map(async (elem) => {
      const src = $(elem).attr('src');
      if (src && src.startsWith('images/')) {
        const imgPath = path.join(__dirname, '..', src);
        await fs.unlink(imgPath).catch(err => console.error(`Error deleting content image ${src}:`, err));
      }
    });

    await Promise.all(deletePromises);

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
};