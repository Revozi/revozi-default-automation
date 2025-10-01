const { triggerTrap } = require('../traps/magicLoginTrap');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const QUEUE_FILE = path.join(__dirname, '../logs/trap_queue.json');

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const content = fs.readFileSync(QUEUE_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

function saveQueue(q) {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
  } catch {}
}

exports.triggerTrap = async (req, res) => {
  const { platform } = req.params;
  const { user, phone } = req.body;
  try {
    await triggerTrap(user, platform, phone || null);

    // Log to file
    const logLine = `[${new Date().toISOString()}] Trap triggered: platform=${platform}, user=${user}${phone ? `, phone=${phone}` : ''}\n`;
    fs.appendFileSync(path.join(__dirname, '../logs/trapEvents.log'), logLine);

    // Queue follow-ups
    const queue = loadQueue();
    queue.push({
      id: uuidv4(),
      user,
      phone: phone || null,
      platform,
      created_at: new Date().toISOString(),
      reminders: 0,
      last_sent: null,
      unsubscribed: false
    });
    saveQueue(queue);

    res.json({ message: 'Trap captured and scheduled follow-ups' });
  } catch (err) {
    res.status(500).json({ error: 'Trap trigger failed' });
  }
};
