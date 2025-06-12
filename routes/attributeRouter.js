const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');

// Attribute routes
router.get('/', attributeController.getAllAttributes);
router.get('/:id', attributeController.getAttributeById);
router.post('/', attributeController.createAttribute);
router.put('/:id', attributeController.updateAttribute);
router.delete('/:id', attributeController.deleteAttribute);
router.put('/:id/toggle-visibility', attributeController.toggleAttributeVisibility);

module.exports = router;