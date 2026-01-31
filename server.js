require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
// REMOVED: authRoutes - Using Crimson Gateway auth instead
const { serviceAuth, publicRoute } = require("./middlewares/serviceAuth");
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

// ============================================
// SERVICE AUTHENTICATION (The Bridge)
// ============================================
// Public routes (no authentication required)
app.get("/health", publicRoute, (req, res) => {
  res.json({ status: "ok", service: "dev-e-auto", port: 5100 });
});
app.use('/leaderboard', publicRoute, leaderboardRoutes); // Public leaderboard
app.use("/unsubscribe", publicRoute, unsubscribeRoutes); // Email unsubscribe links

// Webhook routes (validate via Twilio signature or webhook secret, not service auth)
app.use("/webhooks", twilioWebhook);
app.use('/webhooks/rewards', rewardsWebhooks);

// Protected routes (require service authentication from Gateway)
app.use("/trap", serviceAuth, trapRoutes);
app.use("/admin", serviceAuth, adminRoutes);
app.use('/verify', serviceAuth, verificationRoutes);
app.use('/rewards', serviceAuth, rewardsRoutes);

// Serve admin HTML (protected)
app.get("/admin", serviceAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.use(express.static("public"));

const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  logger.info(`[Crimson Dev-E-Auto] Automation Worker listening on port ${PORT}`);
  logger.info(`[Crimson Dev-E-Auto] Service Auth: ${process.env.SERVICE_KEY ? '✓ Configured' : '✗ Missing SERVICE_KEY'}`);
});

//  Start cron jobs
cleanupInactive();
startCronJobs();
dispatcherCron();
reminderCron();
blogCron(); 
