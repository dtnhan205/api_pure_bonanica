const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');
const { authMiddleware, isAdmin } = require('../middlewares/auth');


// Attribute routes
router.get('/', attributeController.getAllAttributes);
router.get('/:id', attributeController.getAttributeById);
router.post('/',authMiddleware,isAdmin, attributeController.createAttribute);
router.put('/:id',authMiddleware,isAdmin, attributeController.updateAttribute);
router.delete('/:id',authMiddleware,isAdmin, attributeController.deleteAttribute);
router.put('/:id/toggle-visibility',authMiddleware,isAdmin, attributeController.toggleAttributeVisibility);

module.exports = router;