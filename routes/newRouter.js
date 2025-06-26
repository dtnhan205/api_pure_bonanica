const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newController');
const { optionalUpload, handleMulterError } = require('../middlewares/multerConfig');

router.get('/', newsController.getAllNews);
router.get('/:identifier', newsController.getNewsById);
router.get('/hottest', newsController.getHottestNews);
router.post('/', newsController.verifyAdmin, optionalUpload, handleMulterError, newsController.createNews);
router.put('/:identifier', newsController.verifyAdmin, optionalUpload, handleMulterError, newsController.updateNews);
router.delete('/:identifier', newsController.verifyAdmin, newsController.deleteNews);
router.put('/:identifier/toggle-visibility', newsController.verifyAdmin, newsController.toggleNewsVisibility);

module.exports = router;