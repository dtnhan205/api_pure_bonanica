const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.get('/getall',authMiddleware, isAdmin, cartController.getAllCarts);
router.get('/', cartController.getCartItems);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateQuantity);
router.delete('/remove/:productId', cartController.removeItem);
router.delete('/clear', cartController.clearCart);
router.post('/checkout', cartController.checkout);
router.post('/update-price', cartController.updatePrice);

module.exports = router;