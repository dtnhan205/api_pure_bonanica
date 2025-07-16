const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); 

// Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = req.path.includes('/news') ? 'news_thumbnails' : 'product_images';
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'jpg';
    return {
      folder,
      format: ext,
      public_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    };
  }
});

// Lọc file hợp lệ (chỉ ảnh)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ file ảnh (jpg, jpeg, png, gif, webp, svg)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 20,
    fields: 100,
    parts: 120
  }
});

// Giữ nguyên các hàm dùng cho route cũ
const newsUpload = upload.fields([{ name: 'thumbnail', maxCount: 1 }]);
const productUpload = upload.array('images', 10);

// Tự chọn middleware dựa trên URL
const optionalUpload = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  const middleware = req.path.includes('/news') ? newsUpload : productUpload;

  middleware(req, res, (err) => {
    if (err) {
      console.warn('Lỗi khi xử lý upload:', err.message);
      req.files = []; // giữ structure để tránh lỗi router
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
  newsUpload
};
