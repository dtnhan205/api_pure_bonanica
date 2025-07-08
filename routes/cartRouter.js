const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


router.get('/getall',authMiddleware, isAdmin, cartController.getAllCarts);
router.get('/',authMiddleware, cartController.getCartItems);
router.post('/add',authMiddleware, cartController.addToCart);
router.put('/update',authMiddleware, cartController.updateQuantity);
router.delete('/remove/:cartId/:productId/:optionId',authMiddleware, cartController.removeItem);
router.delete('/clear',authMiddleware, cartController.clearCart);
router.post('/checkout',authMiddleware, cartController.checkout);
router.post('/update-price',authMiddleware, cartController.updatePrice);

module.exports = router;