const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Debug log để kiểm tra Multer
console.log('Multer loaded:', !!multer);

// Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'uploads';
    let resource_type = 'image';

    if (file.fieldname === 'contentImages') folder = 'news_content';
    else if (file.fieldname === 'thumbnail') folder = 'news_thumbnails';
    else if (file.fieldname === 'images') folder = 'comment_images';
    else if (file.fieldname === 'commentVideo') {
      folder = 'comment_videos';
      resource_type = 'video';
    } else if (file.fieldname === 'orderVideo') {
      folder = 'order_videos';
      resource_type = 'video';
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'jpg';
    return {
      folder,
      format: ext,
      resource_type,
      public_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    };
  }
});

// Lọc file hợp lệ (ảnh và video)
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
  const allowedImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const allowedVideoExts = ['.mp4', '.mpeg', '.mov', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    (allowedImageTypes.includes(file.mimetype) && allowedImageExts.includes(ext)) ||
    (allowedVideoTypes.includes(file.mimetype) && allowedVideoExts.includes(ext))
  ) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ file ảnh (jpg, jpeg, png, gif, webp, svg) hoặc video (mp4, mpeg, mov, webm)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 5, // Giới hạn tổng số file là 5 (ảnh + video)
    fields: 100,
    parts: 120
  }
});

// Debug log để kiểm tra upload
console.log('Upload middleware initialized:', !!upload);

// Cập nhật middleware cho news
const newsUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'contentImages', maxCount: 10 }
]);

// Middleware cho comment (tổng cộng 5 file: ảnh + video)
const commentUpload = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'commentVideo', maxCount: 5 }
]);

// Middleware cho order (video hoàn hàng)
const orderUpload = upload.fields([
  { name: 'orderVideo', maxCount: 1 }
]);

const productUpload = upload.array('images', 10);

// Middleware tự chọn dựa trên URL
const optionalUpload = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  let middleware;
  if (req.path.includes('/news')) {
    middleware = newsUpload;
  } else if (req.path.includes('/comments')) {
    middleware = commentUpload;
  } else if (req.path.includes('/order')) {
    middleware = orderUpload;
  } else {
    middleware = productUpload;
  }

  middleware(req, res, (err) => {
    if (err) {
      console.warn('Lỗi khi xử lý upload:', err.message);
      req.files = {}; // Đặt thành object rỗng để tránh lỗi
    }
    next();
  });
};

// Middleware lỗi multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Tệp vượt quá kích thước cho phép (100MB)!' });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Số lượng tệp vượt quá giới hạn (5 tệp)!' });
    } else {
      return res.status(400).json({ error: `Lỗi upload file: ${err.message}` });
    }
  } else if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

module.exports = {
  upload,
  optionalUpload,
  handleMulterError,
  newsUpload,
  commentUpload,
  orderUpload,
  productUpload
};