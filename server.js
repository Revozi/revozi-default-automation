require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const authRoutes = require("./routes/authRoutes");
const trapRoutes = require("./routes/trapRoutes");
const adminRoutes = require("./routes/adminRoutes");
const unsubscribeRoutes = require("./routes/unsubscribeRoutes");
const twilioWebhook = require("./routes/twilioWebhook");
const verificationRoutes = require('./routes/verificationRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const rewardsWebhooks = require('./routes/webhooks');
const rewardsRoutes = require('./routes/rewardsRoutes');
const startCronJobs = require("./cron/scheduleBots");
const cleanupInactive = require("./cron/cleanupInactive");
const dispatcherCron = require("./cron/dispatcher");
const reminderCron = require("./cron/reminderScheduler"); // ✅ match file name
const blogCron = require("./cron/blogCron");

const logger = require("./utils/logger");
const path = require("path");

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*'}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true })); // needed for Twilio webhook

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Add geo-detection middleware
const geoip = require('geoip-lite');
app.use((req, res, next) => {
  // Try X-Forwarded-For first (for proxies)
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const geo = geoip.lookup(ip);
  req.geo = geo?.country || 'US'; // Default to US if lookup fails
  next();
});

app.use("/auth", authRoutes);
app.use("/trap", trapRoutes);
app.use("/admin", adminRoutes);
app.use("/unsubscribe", unsubscribeRoutes);
app.use("/webhooks", twilioWebhook);
app.use('/verify', verificationRoutes);
app.use('/webhooks/rewards', rewardsWebhooks);
app.use('/leaderboard', leaderboardRoutes);
app.use('/rewards', rewardsRoutes);

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.use(express.static("public"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`[Server] Listening on port ${PORT}`);
});

//  Start cron jobs
cleanupInactive();
startCronJobs();
dispatcherCron();
reminderCron();
blogCron(); 
