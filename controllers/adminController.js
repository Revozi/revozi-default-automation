const db = require("../services/db")
const fs = require("fs")
const path = require("path")
const logger = require("../utils/logger")
const cron = require("node-cron")
// Import all bot functions
const runInstagramBot = require("../bots/instagramBot")
const runTwitterBot = require("../bots/twitterBot")
const runTikTokBot = require("../bots/tiktokBot")
const runTelegramBot = require("../bots/telegramBot")
const runFacebookBot = require("../bots/facebookBot")
const runRedditBot = require("../bots/redditBot")
const runGmbBot = require("../bots/gmbBot")
const runPinterestBot = require("../bots/pinterestBot")

const botFunctions = {
  instagram: runInstagramBot,
  twitter: runTwitterBot,
  tiktok: runTikTokBot,
  telegram: runTelegramBot,
  facebook: runFacebookBot,
  reddit: runRedditBot,
  gmb: runGmbBot,
  pinterest: runPinterestBot,
}

// --- BOT STATUS TRACKING ---
// --- Utility: fetch interval from settings or default ---
async function getBotInterval(botName) {
  const result = await db.query(
    `SELECT value FROM automation.settings WHERE key = $1`,
    [`${botName}_interval`]
  );
  
  // Defaults
  const defaults = {
    instagram: '*/15 * * * *',
    twitter: '5,35 * * * *',
    tiktok: '10,40 * * * *',
    telegram: '20 * * * *',
    facebook: '25,55 * * * *',
    reddit: '30 * * * *',
    gmb: '45 * * * *',
    pinterest: '50 * * * *',
  };
  
  let interval = (result.rows[0] && typeof result.rows[0].value === 'string' && result.rows[0].value.trim()) 
    ? result.rows[0].value.trim() 
    : defaults[botName] || '*/15 * * * *';
  
  // Validate: must be a non-empty string
  if (typeof interval !== 'string' || !interval.length) {
    interval = '*/15 * * * *';
    logger.info(`[Admin] Invalid cron interval for ${botName}, using default: ${interval}`);
  }
  return interval;
}

// --- Bot status helpers ---
async function updateBotStatus(botName, status, lastError = null) {
  // Only update last_run if status is completed or error
  const update = {
    bot_name: botName,
    status,
    last_error: lastError,
    updated_at: new Date()
  };
  if (status === 'completed' || status === 'error') {
    update.last_run = new Date();
  }
  
  await db.upsert('bot_status', update, ['bot_name']);
}

async function getBotStatus(botName) {
  const result = await db.query(
    `SELECT * FROM automation.bot_status WHERE bot_name = $1`,
    [botName]
  );
  return result.rows[0] || null;
}

// --- Cron Jobs Control ---
const cronJobs = {}; // { botName: cronTask }

async function scheduleBot(botName) {
  const interval = await getBotInterval(botName);
  if (!interval || typeof interval !== 'string' || !interval.length) {
    logger.error(`[Admin] scheduleBot: Invalid cron interval for ${botName}, skipping schedule.`);
    return;
  }
  if (cronJobs[botName]) {
    cronJobs[botName].stop();
  }
  cronJobs[botName] = cron.schedule(interval, async () => {
    // Skip if paused
    const statusRow = await getBotStatus(botName);
    if (statusRow && statusRow.status === 'paused') {
      logger.info(`Skipped ${botName} (paused)`);
      return;
    }
    await exports.runBotInternal(botName);
  });
  logger.info(`Scheduled ${botName} with interval ${interval}`);
}

function pauseBot(botName) {
  if (cronJobs[botName]) {
    cronJobs[botName].stop();
    logger.info(`Paused ${botName}`);
  }
  updateBotStatus(botName, 'paused', null);
}

function resumeBot(botName) {
  if (cronJobs[botName]) {
    cronJobs[botName].start();
    logger.info(`Resumed ${botName}`);
  } else {
    scheduleBot(botName);
  }
  updateBotStatus(botName, 'idle', null);
}

async function restartAllBots() {
  for (const botName of Object.keys(botFunctions)) {
    await scheduleBot(botName);
  }
}

// --- Internal run with status tracking ---
exports.runBotInternal = async (botName) => {
  if (!botFunctions[botName]) return;
  await updateBotStatus(botName, 'running', null);
  try {
    await botFunctions[botName]();
    await updateBotStatus(botName, 'completed', null);
  } catch (err) {
    logger.error(`[Admin] ${botName} bot error: ${err.message}`);
    await updateBotStatus(botName, 'error', err.message);
  }
};

// --- ADMIN CONTROLLER EXPORTS ---

// Dashboard stats
exports.getStats = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM automation.users`
    );
    const totalUsers = parseInt(result.rows[0].count) || 0;
    const activeBots = Object.keys(botFunctions).length

    const logPath = path.join(__dirname, "../logs/trapEvents.log")
    let trapTriggers = 0
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, "utf8")
      trapTriggers = (logContent.match(/Trap triggered/g) || []).length
    }

    res.json({
      totalUsers,
      activeBots,
      trapTriggers,
      cronJobs: Object.keys(cronJobs).length,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" })
  }
}

// System status
exports.getStatus = async (req, res) => {
  try {
    // PostgreSQL health check
    const result = await db.query(`SELECT 1 as health`);
    const dbStatus = result.rows.length > 0;

    // Example: check if at least one bot is healthy (dryRun)
    let botHealth = false
    try {
      if (typeof runInstagramBot === "function") {
        if (runInstagramBot.length > 0) {
          // If bot supports dryRun param
          await runInstagramBot({ dryRun: true })
        } else {
          await runInstagramBot()
        }
        botHealth = true
      }
    } catch (e) {
      botHealth = false
    }

    res.json({
      database: dbStatus,
      server: true,
      cronJobs: Object.keys(cronJobs).length > 0,
      botHealth,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get status" })
  }
}

// Recent activity
exports.getActivity = async (req, res) => {
  try {
    const logPath = path.join(__dirname, "../logs/trapEvents.log")
    const activities = []

    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, "utf8")
      const lines = logContent.split("\n").filter((line) => line.trim())

      // Get last 10 log entries
      const recentLines = lines.slice(-10).reverse()

      recentLines.forEach((line) => {
        const match = line.match(/\[(.*?)\] INFO: (.*)/)
        if (match) {
          activities.push({
            timestamp: match[1],
            message: match[2],
          })
        }
      })
    }

    res.json(activities)
  } catch (error) {
    res.status(500).json({ error: "Failed to get activity" })
  }
}

// User management
exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, phone, referrer, created_at, notified, reminders_sent, active 
       FROM automation.users`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to get users" })
  }
}

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await db.query(
      `DELETE FROM automation.users WHERE id = $1`,
      [userId]
    );
    res.json({ message: "User deleted successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" })
  }
}

// Bot management
// --- Admin API endpoints ---

// Run bot manually
exports.runBot = async (req, res) => {
  try {
    const { botName } = req.params
    if (!botFunctions[botName]) {
      return res.status(400).json({ error: 'Invalid bot name' })
    }
    logger.info(`[Admin] Running ${botName} bot manually`)
    exports.runBotInternal(botName)
    res.json({ message: `${botName} bot started` })
  } catch (err) {
    res.status(500).json({ error: 'Failed to run bot' })
  }
}

// Pause specific bot
exports.pauseBot = async (req, res) => {
  try {
    const { botName } = req.params;
    pauseBot(botName);
    res.json({ message: `${botName} paused` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause bot' });
  }
};

// Resume specific bot
exports.resumeBot = async (req, res) => {
  try {
    const { botName } = req.params;
    resumeBot(botName);
    res.json({ message: `${botName} resumed` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume bot' });
  }
};

// Restart all cron jobs
exports.restartCronJobs = async (req, res) => {
  try {
    await restartAllBots()
    res.json({ message: 'All cron jobs restarted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to restart cron jobs' })
  }
}

// Get status of all bots
exports.getBotStatus = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM automation.bot_status`);
    const statusMap = {};
    result.rows.forEach(entry => {
      statusMap[entry.bot_name] = {
        lastRun: entry.last_run,
        status: entry.status,
        lastError: entry.last_error,
        updatedAt: entry.updated_at
      };
    });
    res.json(statusMap);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get statuses' })
  }
}

// Cron job management
exports.restartCronJobs = async (req, res) => {
  try {
    logger.info("[Admin] Cron jobs restart requested")
    restartAllBots()
    res.json({ message: "Cron jobs restarted successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to restart cron jobs" })
  }
}

exports.pauseCronJob = async (req, res) => {
  try {
    const { botName } = req.params
    logger.info(`[Admin] Pausing ${botName} cron job`)
    pauseBot(botName)
    await updateBotStatus(botName, 'paused', null)
    res.json({ message: `${botName} cron job paused` })
  } catch (error) {
    res.status(500).json({ error: "Failed to pause cron job" })
  }
}

// Logs management
exports.getLogs = async (req, res) => {
  try {
    const { filter } = req.query
    const logPath = path.join(__dirname, "../logs/trapEvents.log")

    if (!fs.existsSync(logPath)) {
      return res.json({ content: "No logs available" })
    }

    let content = fs.readFileSync(logPath, "utf8")

    // Filter logs if specified
    if (filter && filter !== "all") {
      const lines = content.split("\n")
      const filteredLines = lines.filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
      content = filteredLines.join("\n")
    }

    res.json({ content })
  } catch (error) {
    res.status(500).json({ error: "Failed to get logs" })
  }
}

exports.clearLogs = async (req, res) => {
  try {
    const logPath = path.join(__dirname, "../logs/trapEvents.log")
    fs.writeFileSync(logPath, "")
    logger.info("[Admin] Logs cleared")
    res.json({ message: "Logs cleared successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to clear logs" })
  }
}

// Trap management
exports.getTrapData = async (req, res) => {
  try {
    const logPath = path.join(__dirname, "../logs/trapEvents.log")
    let magicLoginTriggers = 0
    const recentEvents = []

    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, "utf8")
      const lines = logContent.split("\n").filter((line) => line.trim())

      // Count magic login triggers
      magicLoginTriggers = lines.filter(
        (line) => line.includes("Trap triggered") && line.includes("magic-login"),
      ).length

      // Get recent trap events
      const trapLines = lines.filter((line) => line.includes("Trap triggered")).slice(-5)

      trapLines.forEach((line) => {
        const match = line.match(/\[(.*?)\].*platform=(\w+).*user=([^,\s]+)/)
        if (match) {
          recentEvents.push({
            timestamp: match[1],
            platform: match[2],
            user: match[3],
          })
        }
      })
    }

    res.json({
      magicLoginTriggers,
      recentEvents,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get trap data" })
  }
}

// Settings persistence
exports.saveSettings = async (req, res) => {
  try {
    const settings = req.body
    logger.info("[Admin] Settings updated")
    for (const [key, value] of Object.entries(settings)) {
      await db.upsert('settings', {
        key,
        value,
        updated_at: new Date()
      }, ['key']);
    }
    res.json({ message: "Settings saved successfully" })
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" })
  }
}

exports.getSettings = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM automation.settings`);
    const formatted = Object.fromEntries(result.rows.map(({ key, value }) => [key, value]));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' })
  }
}

// --- Initialize all bot statuses and cron jobs on startup ---
(async () => {
  // On startup, ensure each bot has a status row (idle)
  for (const botName of Object.keys(botFunctions)) {
    await updateBotStatus(botName, 'idle', null);
  }
  await restartAllBots();
})();
