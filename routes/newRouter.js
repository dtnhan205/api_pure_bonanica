const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newController');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');
const { upload, handleMulterError } = require('../middlewares/upload');

// Middleware xác thực admin
const authAdmin = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findOne({ _id: decoded.id, role: 'admin' });
        if (!admin) {
            return res.status(401).json({ message: 'Không có quyền admin' });
        }
        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token không hợp lệ', error: error.message });
    }
};

router.get('/', newsController.getAllNews);

router.get('/:id', newsController.getNewsById);

router.get('/hottest', newsController.getHottestNews); 
router.post(
    '/',
    authAdmin,
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'contentImages' },
    ]),
    handleMulterError,
    newsController.createNews
);

router.put(
  '/:id',
  authAdmin,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'contentImages' },
  ]),
  handleMulterError,
  newsController.updateNews
);

router.delete('/:id', authAdmin, newsController.deleteNews);

router.put('/:id/toggle-visibility', authAdmin, newsController.toggleNewsVisibility);

module.exports = router;