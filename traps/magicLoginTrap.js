const axios = require('axios');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { sendVerification } = require('../utils/verificationService');

function resolveSignupUrl() {
  const explicitUrl = process.env.TRAP_SIGNUP_URL;
  if (explicitUrl) return explicitUrl;

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/auth/signup`;
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/\/$/, '')}/auth/signup`;
  }

  return 'http://localhost:3000/auth/signup';
}

async function triggerTrap(userIdentifier, platform, phone = null) {
  try {
    const signupUrl = resolveSignupUrl();
    const response = await axios.post(signupUrl, {
      email: userIdentifier,
      phone,
      referrer: platform || 'magicLoginTrap',
      password: process.env.TRAP_DEFAULT_PASSWORD || 'TrapUser!123'
    });

    logger.info(`[TRAP] Signup trap for ${userIdentifier} on ${platform} via ${signupUrl}`);
    logger.debug(`[TRAP] Response: ${JSON.stringify(response.data)}`);

    // If phone provided, attempt to send a verification code via Twilio (sms or whatsapp)
    if (phone) {
      try {
        const requestedVia = phone.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
        const normalizedTo = requestedVia === 'whatsapp' ? phone.replace(/^whatsapp:/, '') : phone;
        const via =
          requestedVia === 'whatsapp' && process.env.ENABLE_WHATSAPP !== 'true'
            ? 'sms'
            : requestedVia;

        if (requestedVia === 'whatsapp' && via === 'sms') {
          logger.info('[TRAP] WhatsApp verification disabled, falling back to SMS');
        }

        await sendVerification({ to: normalizedTo, via });
        logger.info(`[TRAP] Sent ${via} verification to ${normalizedTo}`);
      } catch (err) {
        logger.error(`[TRAP] Verification send failed: ${err.message}`);
      }
    }

    // Notify admins about the trap
    try {
      await notificationService.notifyTrap({ platform, user: userIdentifier, message: `Trap executed. Signup response: ${response.status}` });
    } catch (err) {
      logger.error(`[TRAP] notifyTrap failed: ${err.message}`);
    }
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.error(`[TRAP] Signup trap failed: ${detail}`);
  }
}

module.exports = { triggerTrap };
