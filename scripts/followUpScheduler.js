require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/emailService');
const { sendWhatsApp } = require('../utils/whatsappService');
const { sendSMS } = require('../utils/smsService');
const logger = require('../utils/logger');

const QUEUE_FILE = path.join(__dirname, '../logs/trap_queue.json');
const SUPPRESSION_FILE = path.join(__dirname, '../logs/suppression_list.json');
const CHECK_URL = (process.env.SIGNUP_API_URL || '').replace(/\/$/, '') + '/status';

function load(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    logger.error(`[SCHEDULER] Failed to read ${file}: ${e.message}`);
    return [];
  }
}

function save(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(`[SCHEDULER] Failed to write ${file}: ${e.message}`);
  }
}

async function hasConverted(userEmail) {
  if (!process.env.SIGNUP_API_URL) return false;
  try {
    const r = await axios.get(`${CHECK_URL}?email=${encodeURIComponent(userEmail)}`);
    return r.data && r.data.converted;
  } catch (e) {
    logger.error('[SCHEDULER] Conversion check error: ' + e.message);
    return false;
  }
}

async function processQueue() {
  const queue = load(QUEUE_FILE);
  const supList = load(SUPPRESSION_FILE);
  const now = Date.now();

  const thresholds = [15 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];

  for (const item of queue) {
    if (item.unsubscribed) continue;
    if (supList.some(s => s.user === item.user || s.phone === item.phone)) continue;

    if (await hasConverted(item.user)) {
      logger.info(`[SCHEDULER] User ${item.user} converted. Stopping reminders.`);
      item.unsubscribed = true;
      continue;
    }

    const ageMs = now - new Date(item.created_at).getTime();
    const remindersSent = item.reminders || 0;

    if (remindersSent < 3 && ageMs >= thresholds[remindersSent]) {
      try {
        const landing = process.env.LANDING_URL || '';
        const optout = 'Reply STOP to opt out.';
        if (remindersSent === 0) {
          await sendEmail(
            item.user,
            'You’re almost there – complete your signup',
            `Hi, you started signing up but didn't finish. You can complete here: ${landing}\n\n${optout}`
          );
        } else if (remindersSent === 1 && item.phone) {
          await sendWhatsApp(
            item.phone,
            `You started signing up but didn’t finish. Complete here: ${landing} — ${optout}`
          );
        } else if (remindersSent === 2 && item.phone) {
          await sendSMS(
            item.phone,
            `Final reminder: complete your signup here: ${landing}. ${optout}`
          );
        }

        item.reminders = (item.reminders || 0) + 1;
        item.last_sent = new Date().toISOString();
        logger.info(`[SCHEDULER] Sent reminder #${item.reminders} to ${item.user}`);
      } catch (err) {
        logger.error(`[SCHEDULER] Failed reminder for ${item.user}: ${err.message}`);
      }
    }
  }

  save(QUEUE_FILE, queue);
}

processQueue();


