const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const jwt = require('jsonwebtoken');
const {isAdmin } = require('../middlewares/auth');



router.post('/', contactController.createContact);

router.get('/', isAdmin, contactController.getAllContacts);
router.get('/:id', isAdmin, contactController.getContactById);
router.put('/:id', isAdmin, contactController.updateContact);
router.delete('/:id', isAdmin, contactController.deleteContact);


module.exports = router;