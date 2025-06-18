const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newController');
const jwt = require('jsonwebtoken');
const Admin = require('../models/user');
const { optionalUpload, handleMulterError } = require('../middlewares/multerConfig');

router.get('/', newsController.getAllNews);
router.get('/:id', newsController.getNewsById);
router.get('/hottest', newsController.getHottestNews);
router.post('/', optionalUpload, handleMulterError, newsController.createNews);
router.put('/:id', optionalUpload, handleMulterError, newsController.updateNews);
router.delete('/:id', newsController.deleteNews);
router.put('/:id/toggle-visibility', newsController.toggleNewsVisibility);

module.exports = router;