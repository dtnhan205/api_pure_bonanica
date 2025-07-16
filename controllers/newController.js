const mongoose = require('mongoose');
const News = require('../models/news');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');
const cheerio = require('cheerio');
const cloudinary = require('../middlewares/cloudinary');

// Hàm tạo slug duy nhất
const generateSlug = async (title, currentNewsId = null) => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  let uniqueSlug = baseSlug;
  const regex = new RegExp(`^${baseSlug}(-\d+)?$`, 'i');
  const existingSlugs = await News.find(
    { slug: regex, _id: { $ne: currentNewsId } },
    'slug'
  ).lean();

  if (existingSlugs.length === 0 || !existingSlugs.some(doc => doc.slug === baseSlug)) {
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

  return uniqueSlug;
};

const uploadBase64ToCloudinary = async (dataUrl, folder = 'news_content') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(dataUrl, {
      folder,
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    });
  });
};

const isValidHTML = (content) => {
  try {
    cheerio.load(content, { xmlMode: false, decodeEntities: false });
    return true;
  } catch (e) {
    return false;
  }
};

const processContentImages = async (content) => {
  if (!isValidHTML(content)) {
    throw new Error('Nội dung HTML không hợp lệ');
  }

  const $ = cheerio.load(content, { xmlMode: false, decodeEntities: false });
  const imgTags = $('img');
  const imagePaths = [];

  const promises = Array.from(imgTags).map(async (elem, i) => {
    let src = $(elem).attr('src');
    if (!src || !src.startsWith('data:image/')) return;

    const matches = src.match(/^data:image\/([a-z]+);base64,(.+)$/);
    if (!matches) return;

    const ext = matches[1].toLowerCase();
    const dataUrl = src;

    try {
      const cloudinaryUrl = await uploadBase64ToCloudinary(dataUrl);
      $(elem).attr('src', cloudinaryUrl);
      imagePaths.push(cloudinaryUrl);
    } catch (err) {
      console.error(`Error uploading image ${i + 1}:`, err);
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
        ? await News.findByIdAndUpdate(identifier, { $inc: { views: 1 } }, { new: true })
        : await News.findOneAndUpdate({ slug: identifier }, { $inc: { views: 1 } }, { new: true });
    }

    if (!news) {
      return res.status(404).json({ message: 'Không tìm thấy tin tức' });
    }
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy tin tức', error: error.message });
  }
};

exports.getHottestNews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    let query = News.find({ status: 'show' }).sort({ views: -1 });
    if (limit > 0) query = query.limit(limit);
    const hottestNewsList = await query;

    if (hottestNewsList.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy bài đăng nào' });
    }
    res.json({ message: 'Lấy danh sách bài đăng hot thành công', news: hottestNewsList });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài đăng hot', error: error.message });
  }
};

exports.createNews = async (req, res) => {
  try {
    const { title, slug, thumbnailCaption, publishedAt, views, status, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc: title, content' });
    }

    const thumbnail = req.files?.['thumbnail']?.[0];
    if (!thumbnail || !thumbnail.path) {
      return res.status(400).json({ error: 'Không tìm thấy file thumbnail' });
    }

    const thumbnailUrl = thumbnail.path;
    const { processedContent } = await processContentImages(content);
    const finalSlug = slug || await generateSlug(title);

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
    res.status(201).json({ message: 'Tạo tin tức thành công', news: newNews });
  } catch (err) {
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

    const { title, slug, thumbnailCaption, publishedAt, views, status, content } = req.body;

    const thumbnail = req.files?.['thumbnail']?.[0];
    const thumbnailUrl = thumbnail?.path;
    const { processedContent } = await processContentImages(content);

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

    const updatedNews = await News.findOneAndUpdate(query, { $set: updateData }, { new: true, runValidators: true });

    if (!updatedNews) {
      return res.status(404).json({ error: 'Không tìm thấy tin tức để cập nhật' });
    }

    res.json({ message: 'Cập nhật tin tức thành công', news: updatedNews });
  } catch (err) {
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

    res.json({ message: `Tin tức đã được ${news.status === 'show' ? 'hiển thị' : 'ẩn'}`, news });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};
