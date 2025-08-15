const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

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
    }
    else if (file.fieldname === 'orderVideo') {
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
    fileSize: 100 * 1024 * 1024, // Tăng lên 100MB để hỗ trợ video
    files: 20,
    fields: 100,
    parts: 120
  }
});

// Cập nhật middleware cho news để xử lý cả thumbnail và contentImages
const newsUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'contentImages', maxCount: 10 }
]);

// Middleware cho comment (ảnh và video)
const commentUpload = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'commentVideo', maxCount: 1 }
]);

// Middleware cho order (video hoàn hàng)
const orderUpload = upload.fields([
  { name: 'orderVideo', maxCount: 1 }
]);

const productUpload = upload.array('images', 10);

// Tự chọn middleware dựa trên URL
const optionalUpload = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  let middleware;
  if (req.path.includes('/news')) {
    middleware = newsUpload;
  } else if (req.path.includes('/comment')) {
    middleware = commentUpload;
  } else if (req.path.includes('/order')) {
    middleware = orderUpload;
  } else {
    middleware = productUpload;
  }

  middleware(req, res, (err) => {
    if (err) {
      console.warn('Lỗi khi xử lý upload:', err.message);
      req.files = []; // Giữ structure để tránh lỗi router
    }
    next();
  });
};

// Middleware lỗi multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('file')) {
    return res.status(400).json({ error: `Lỗi upload file: ${err.message}` });
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