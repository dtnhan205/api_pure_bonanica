const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const jwt = require('jsonwebtoken');
const {authMiddleware, isAdmin } = require('../middlewares/auth');



router.post('/', contactController.createContact);

router.get('/',authMiddleware, isAdmin, contactController.getAllContacts);
router.get('/:id',authMiddleware, isAdmin, contactController.getContactById);
router.put('/:id',authMiddleware, isAdmin, contactController.updateContact);
router.delete('/:id',authMiddleware, isAdmin, contactController.deleteContact);


module.exports = router;