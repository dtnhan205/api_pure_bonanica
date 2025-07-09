const multer = require('multer');
const path = require('path');
const fs = require('fs');

const imageUploadDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(imageUploadDir)) {
  fs.mkdirSync(imageUploadDir, { recursive: true });
  fs.chmodSync(imageUploadDir, 0o755);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`Saving file to: ${imageUploadDir}`);
    cb(null, imageUploadDir);
  },
  filename: (req, file, cb) => {
    const filename = file.originalname; // Giữ tên file gốc
    console.log(`Using original filename: ${filename}`);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  console.log(`Processing file: ${file.originalname}, mimetype: ${file.mimetype}, size: ${file.size || 'undefined'} bytes`);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    console.warn(`Invalid file type or extension: ${file.originalname}`);
    cb(new Error('Chỉ hỗ trợ file ảnh (jpg, jpeg, png, gif, webp, svg)'), false);
  }
};

// Cấu hình multer
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB
    fields: 100,
    parts: 120,
    files: 20
  }
});

// Middleware cho news endpoints
const newsUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'contentImages', maxCount: 10 }
]);

// Middleware cho product endpoints
const productUpload = upload.array('images', 10);

// Middleware tùy chỉnh để bỏ qua multer nếu không có form-data
const optionalUpload = (req, res, next) => {
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    console.log('No multipart/form-data, skipping multer');
    return next();
  }
  // Chọn middleware dựa trên route
  const middleware = req.path.includes('/news') ? newsUpload : productUpload;
  middleware(req, res, (err) => {
    if (err) {
      console.warn(`Multer error caught in optionalUpload: ${err.message}`);
      req.files = []; // Đặt req.files rỗng để controller xử lý
      next();
    } else {
      next();
    }
  });
};

const handleMulterError = (err, req, res, next) => {
  console.error('Multer error:', err.message, err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Lỗi upload: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = {
  upload,
  optionalUpload,
  handleMulterError
};