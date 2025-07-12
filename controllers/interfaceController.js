const Interface = require('../models/interface');
const fs = require('fs').promises;
const path = require('path');

const imageDir = path.join(__dirname, '..', 'public', 'images');

const updateImage = async (type, files, res) => {
  try {
    let paths = [];
    if (Array.isArray(files)) {
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Không có file nào được tải lên' });
      }
      paths = files.map(file => `images/${file.filename}`);
    } else if (files) {
      paths = [`images/${files.filename}`];
    } else {
      return res.status(400).json({ error: 'Không có file nào được tải lên' });
    }

    // Xóa hình cũ nếu tồn tại
    const oldImages = await Interface.findOne({ type });
    if (oldImages) {
      for (const oldPath of oldImages.paths) {
        const fullPath = path.join(__dirname, '..', oldPath);
        await fs.unlink(fullPath).catch(err => console.error(`Error deleting old image ${oldPath}:`, err));
      }
      await Interface.deleteOne({ type });
    }

    // Lưu hình mới
    const newDoc = new Interface({ type, paths });
    await newDoc.save();

    console.log(`Updated ${type} successfully:`, paths);
    res.status(200).json({ message: `Cập nhật ${type} thành công`, paths });
  } catch (err) {
    console.error(`Error updating ${type}:`, err);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

const getImages = async (type, res) => {
  try {
    const images = await Interface.findOne({ type });
    if (!images || images.paths.length === 0) {
      return res.status(404).json({ error: `Không tìm thấy hình ảnh loại ${type}` });
    }
    const paths = images.paths;
    res.status(200).json({ type, paths });
  } catch (err) {
    console.error(`Error fetching ${type}:`, err);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.updateLogo = (req, res) => updateImage('logo', req.file, res);
exports.updateFavicon = (req, res) => updateImage('favicon', req.file, res);
exports.updateBanner1 = (req, res) => updateImage('banner1', req.files, res);
exports.updateBanner2 = (req, res) => updateImage('banner2', req.file, res);
exports.updateDecorImages = (req, res) => updateImage('decor', req.files, res);
exports.updateBanner3 = (req, res) => updateImage('banner3', req.file, res);
exports.updateBannerAbout = (req, res) => updateImage('bannerAbout', req.file, res);
exports.updateBannerNews = (req, res) => updateImage('bannerNews', req.file, res);

exports.getLogo = (req, res) => getImages('logo', res);
exports.getFavicon = (req, res) => getImages('favicon', res);
exports.getBanner1 = (req, res) => getImages('banner1', res);
exports.getBanner2 = (req, res) => getImages('banner2', res);
exports.getDecorImages = (req, res) => getImages('decor', res);
exports.getBanner3 = (req, res) => getImages('banner3', res);
exports.getBannerAbout = (req, res) => getImages('bannerAbout', res);
exports.getBannerNews = (req, res) => getImages('bannerNews', res);