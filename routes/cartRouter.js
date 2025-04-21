const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware); 

router.get('/', cartController.getCartItems);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateQuantity);
router.delete('/remove/:productId', cartController.removeItem);
router.delete('/clear', cartController.clearCart);
router.post('/checkout', cartController.checkout);

module.exports = router;
