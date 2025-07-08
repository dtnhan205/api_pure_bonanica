const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newController');
const { optionalUpload, handleMulterError } = require('../middlewares/multerConfig');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.get('/', newsController.getAllNews);
router.get('/:identifier', newsController.getNewsById);
router.get('/hottest', newsController.getHottestNews);
router.post('/',authMiddleware,isAdmin, newsController.createNews);
router.put('/:identifier',authMiddleware,isAdmin, newsController.updateNews);
router.delete('/:identifier', authMiddleware,isAdmin, newsController.deleteNews);
router.put('/:identifier/toggle-visibility',authMiddleware,isAdmin, newsController.toggleNewsVisibility);

module.exports = router;