const logger = require('./logger');
const twilio = require('twilio');

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials missing');
  return twilio(sid, token);
}

async function sendWhatsApp(to, message) {
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g., 'whatsapp:+14155238886'
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM missing');
  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  try {
    const client = getClient();
    const resp = await client.messages.create({ to: toAddr, from, body: message });
    logger.info(`[WHATSAPP] Sent message sid=${resp.sid} to=${to}`);
    return { success: true, sid: resp.sid };
  } catch (err) {
    logger.error(`[WHATSAPP] Send failed: ${err.message}`);
    throw err;
  }
}

module.exports = { sendWhatsApp };


