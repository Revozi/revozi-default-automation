const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const QUEUE_FILE = path.join(__dirname, '../logs/trap_queue.json');
const SUPPRESSION_FILE = path.join(__dirname, '../logs/suppression_list.json');

function load(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    logger.error(`[UNSUBSCRIBE] Failed to read ${file}: ${e.message}`);
    return [];
  }
}

function save(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(`[UNSUBSCRIBE] Failed to write ${file}: ${e.message}`);
  }
}

exports.handleUnsubscribe = (req, res) => {
  const { user, phone, reason } = req.body || {};

  if (!user && !phone) {
    return res.status(400).json({ error: 'user or phone is required' });
  }

  try {
    const sup = load(SUPPRESSION_FILE);
    const id = user || phone;
    const entry = {
      id,
      user: user || null,
      phone: phone || null,
      reason: reason || 'manual-unsubscribe',
      ts: new Date().toISOString()
    };

    if (!sup.find(s => s.id === id)) {
      sup.push(entry);
      save(SUPPRESSION_FILE, sup);
    }

    const queue = load(QUEUE_FILE).map(q => {
      if ((user && q.user === user) || (phone && q.phone === phone)) {
        q.unsubscribed = true;
      }
      return q;
    });
    save(QUEUE_FILE, queue);

    return res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err) {
    logger.error(`[UNSUBSCRIBE] Error: ${err.message}`);
    return res.status(500).json({ error: 'Unsubscribe failed' });
  }
};


