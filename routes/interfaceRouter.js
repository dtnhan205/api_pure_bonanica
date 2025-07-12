const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload').upload;
const { authMiddleware, isAdmin } = require('../middlewares/auth');
const {
  updateLogo,
  updateFavicon,
  updateBanner1,
  updateBanner2,
  updateDecorImages,
  updateBanner3,
  updateBannerAbout,
  updateBannerNews,
  getLogo,
  getFavicon,
  getBanner1,
  getBanner2,
  getDecorImages,
  getBanner3,
  getBannerAbout,
  getBannerNews
} = require('../controllers/interfaceController');

router.post('/logo-shop', authMiddleware, isAdmin, upload.single('logo'), updateLogo);
router.post('/favicon', authMiddleware, isAdmin, upload.single('favicon'), updateFavicon);
router.post('/banner1', authMiddleware, isAdmin, upload.array('banner1', 5), updateBanner1);
router.post('/banner2', authMiddleware, isAdmin, upload.single('banner2'), updateBanner2);
router.post('/decor-images', authMiddleware, isAdmin, upload.array('decor', 2), updateDecorImages);
router.post('/banner3', authMiddleware, isAdmin, upload.single('banner3'), updateBanner3);
router.post('/banner-about', authMiddleware, isAdmin, upload.single('bannerAbout'), updateBannerAbout);
router.post('/banner-news', authMiddleware, isAdmin, upload.single('bannerNews'), updateBannerNews);

router.get('/logo-shop', getLogo);
router.get('/favicon', getFavicon);
router.get('/banner1', getBanner1);
router.get('/banner2', getBanner2);
router.get('/decor-images', getDecorImages);
router.get('/banner3', getBanner3);
router.get('/banner-about', getBannerAbout);
router.get('/banner-news', getBannerNews);

module.exports = router;