const logger = require('./logger');
const twilio = require('twilio');

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials missing');
  return twilio(sid, token);
}

async function sendSMS(to, message) {
  const from = process.env.TWILIO_SMS_FROM;
  if (!from) throw new Error('TWILIO_SMS_FROM missing');
  try {
    const client = getClient();
    const resp = await client.messages.create({ to, from, body: message });
    logger.info(`[SMS] Sent message sid=${resp.sid} to=${to}`);
    return { success: true, sid: resp.sid };
  } catch (err) {
    logger.error(`[SMS] Send failed: ${err.message}`);
    throw err;
  }
}

module.exports = { sendSMS };


