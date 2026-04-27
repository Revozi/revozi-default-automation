require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const internalAuth = require("./middlewares/internalAuth");
const trapRoutes = require("./routes/trapRoutes");
const adminRoutes = require("./routes/adminRoutes");
const unsubscribeRoutes = require("./routes/unsubscribeRoutes");
const twilioWebhook = require("./routes/twilioWebhook");
const verificationRoutes = require('./routes/verificationRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const rewardsWebhooks = require('./routes/webhooks');
const rewardsRoutes = require('./routes/rewardsRoutes');
const authRoutes = require('./routes/authRoutes');
const startCronJobs = require("./cron/scheduleBots");
const cleanupInactive = require("./cron/cleanupInactive");
const dispatcherCron = require("./cron/dispatcher");
const reminderCron = require("./cron/reminderScheduler");
const blogCron = require("./cron/blogCron");

const logger = require("./utils/logger");

const app = express();
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8000')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Revozi-User-Id', 'X-Revozi-Workspace-Id', 'X-Internal-Secret']
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Geo-detection middleware
const geoip = require('geoip-lite');
app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const geo = geoip.lookup(ip);
  req.geo = geo?.country || 'US';
  next();
});

// Health check — unauthenticated, used by load balancers / docker-compose depends_on
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "revozi-automation" });
});

// Auth routes are public (login/signup must be reachable before a token exists)
app.use('/auth', authRoutes);

// All business routes require internal auth (called only from Revozi FastAPI proxy)
app.use(internalAuth);

app.use("/trap", trapRoutes);
app.use("/admin", adminRoutes);
app.use("/unsubscribe", unsubscribeRoutes);
app.use("/webhooks", twilioWebhook);
app.use('/verify', verificationRoutes);
app.use('/webhooks/rewards', rewardsWebhooks);
app.use('/leaderboard', leaderboardRoutes);
app.use('/rewards', rewardsRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  logger.info(`[Server] Automation service listening on port ${PORT}`);
});

// Start cron jobs
cleanupInactive();
startCronJobs();
dispatcherCron();
reminderCron();
blogCron();
