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

app.use("/auth", authRoutes);
app.use("/trap", trapRoutes);
app.use("/admin", adminRoutes);
app.use("/unsubscribe", unsubscribeRoutes);
app.use("/webhooks", twilioWebhook);

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`[Server] Listening on port ${PORT}`);
});

//  Start cron jobs
cleanupInactive();
startCronJobs();
dispatcherCron();
reminderCron();
blogCron(); 
