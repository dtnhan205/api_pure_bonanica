const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join('public', 'images')); 
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname)); // Giữ phần mở rộng ảnh
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});

module.exports = upload;