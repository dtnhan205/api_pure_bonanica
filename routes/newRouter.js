const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newController');
const { newsUpload, handleMulterError } = require('../middlewares/upload');
const { authMiddleware, isAdmin } = require('../middlewares/auth');

router.get('/', newsController.getAllNews);
router.get('/hottest', newsController.getHottestNews);
router.get('/:identifier', newsController.getNewsById);
router.post('/', newsUpload, handleMulterError, newsController.createNews);
router.put('/:identifier', newsUpload, handleMulterError, newsController.updateNews);
router.delete('/:identifier', newsController.deleteNews);
router.put('/:identifier/toggle-visibility', newsController.toggleNewsVisibility);

module.exports = router;