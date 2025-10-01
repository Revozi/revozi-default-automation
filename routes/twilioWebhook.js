const express = require('express');
const router = express.Router();
const twilioController = require('../controllers/twilioController');

router.post('/sms', twilioController.handleTwilioWebhook);

module.exports = router;

