const { handleUnsubscribeLogic } = require('../utils/unsubscribeHelper');
const logger = require('../utils/logger');
const twilio = require('twilio');

exports.handleTwilioWebhook = async (req, res) => {
  try {
    // Validate Twilio signature if available
    const signature = req.headers['x-twilio-signature'];
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const url = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') + '/webhooks/sms';
    if (signature && authToken && url) {
      const isValid = twilio.validateRequest(authToken, signature, url, req.body || {});
      if (!isValid) {
        logger.warn('[TWILIO] Invalid webhook signature');
        return res.status(403).send('');
      }
    }
    const body = (req.body && req.body.Body) ? String(req.body.Body).trim().toLowerCase() : '';
    const from = req.body && req.body.From ? String(req.body.From) : null;

    logger.info(`[TWILIO] Incoming from ${from}: ${body}`);

    const STOP_COMMANDS = ['stop','unsubscribe','quit','cancel'];
    if (from && STOP_COMMANDS.includes(body)) {
      await handleUnsubscribeLogic({ phone: from, reason: 'twilio-stop' });
      res.set('Content-Type', 'text/xml');
      res.send(`<Response><Message>You've been unsubscribed.</Message></Response>`);
      return;
    }

    res.status(200).send('');
  } catch (err) {
    logger.error(`[TWILIO] Webhook error: ${err.message}`);
    res.status(500).send('');
  }
};


