const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const QUEUE_FILE = path.join(__dirname, '../logs/trap_queue.json');
const SUPPRESSION_FILE = path.join(__dirname, '../logs/suppression_list.json');

function load(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    logger.error(`[UNSUBSCRIBE_HELPER] Failed to read ${file}: ${e.message}`);
    return [];
  }
}

function save(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(`[UNSUBSCRIBE_HELPER] Failed to write ${file}: ${e.message}`);
  }
}

async function handleUnsubscribeLogic({ user = null, phone = null, reason = 'unsubscribe' }) {
  const sup = load(SUPPRESSION_FILE);
  const id = user || phone;
  if (!sup.find(s => s.id === id)) {
    sup.push({ id, user, phone, reason, ts: new Date().toISOString() });
    save(SUPPRESSION_FILE, sup);
  }

  const queue = load(QUEUE_FILE).map(q => {
    if ((user && q.user === user) || (phone && q.phone === phone)) {
      q.unsubscribed = true;
    }
    return q;
  });
  save(QUEUE_FILE, queue);
}

module.exports = { handleUnsubscribeLogic };


