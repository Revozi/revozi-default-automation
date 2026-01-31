const db = require('../services/db');
const { publishToMedium } = require('../services/mediumService');
const { publishToSubstack } = require('../services/substackService');
const { publishToReddit } = require('../services/redditService');
const { publishToGMB } = require('../services/gmbService');
const logger = require('../utils/logger');

const publishPendingBlogs = async () => {
  try {
    const result = await db.query(
      `SELECT * FROM automation.blogs 
       WHERE published = false 
       LIMIT 5`
    );
    const blogs = result.rows;

    if (!blogs.length) {
      logger.info(`[BLOG_SCHEDULER] No blogs to publish`);
      return;
    }

    for (const blog of blogs) {
      try {
        await publishToMedium(blog);
        await publishToSubstack(blog);
        await publishToReddit({ ...blog, subreddit: process.env.DEFAULT_SUBREDDIT || 'test' });
        await publishToGMB(blog);

        await db.query('UPDATE automation.blogs SET published = true WHERE id = $1', [blog.id]);
        logger.info(`[BLOG_SCHEDULER] Published blog: ${blog.title}`);
      } catch (err) {
        logger.error(`[BLOG_SCHEDULER] Error publishing "${blog.title}": ${err.message}`);
      }
    }
  } catch (error) {
    logger.error(`[BLOG_SCHEDULER] DB Error: ${error.message}`);
  }
};

module.exports = { publishPendingBlogs };
