const logger = require('./logger');

/**
 * Simple rate-limited processor for tasks with concurrency and delay between tasks.
 * Usage: await runWithRateLimit(items, async (item) => { ... }, { concurrency: 2, delayMs: 500 })
 */
async function runWithRateLimit(items, worker, options = {}) {
  const concurrency = options.concurrency || parseInt(process.env.MULTI_POST_CONCURRENCY) || 1;
  const delayMs = options.delayMs || parseInt(process.env.MULTI_POST_DELAY_MS) || 500;

  let idx = 0;
  const results = [];

  async function runner() {
    while (idx < items.length) {
      const current = idx++;
      try {
        results[current] = await worker(items[current]);
      } catch (err) {
        logger.error('[rateLimiter] Worker error', { err: err.message, item: items[current] });
        results[current] = { error: err };
      }
      // delay between tasks to avoid bursts
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const runners = [];
  for (let i = 0; i < concurrency; i++) runners.push(runner());
  await Promise.all(runners);
  return results;
}

module.exports = { runWithRateLimit };
