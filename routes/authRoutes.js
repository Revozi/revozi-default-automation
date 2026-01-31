const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.post('/signup', auth.signup);
router.post('/login', auth.login);
router.post('/send-magic', auth.sendMagic);
router.get('/magic/:token', auth.magicLogin);
router.delete('/delete-inactive', auth.deleteInactive);

module.exports = router;
