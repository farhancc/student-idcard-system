import { logger } from '../src/lib/logger';

const HEALTH_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3000/api/health';
const INTERVAL_MS = 60000; // 1 minute

async function checkHealth() {
  try {
    const start = Date.now();
    const response = await fetch(HEALTH_URL);
    const duration = Date.now() - start;

    if (!response.ok) {
      throw new Error(`HTTP Status ${response.status}`);
    }

    const data = await response.json();
    logger.info({ msg: 'Health check passed', url: HEALTH_URL, duration, data });
  } catch (error: any) {
    logger.error({
      msg: 'CRITICAL: Uptime Health Check Failed!',
      url: HEALTH_URL,
      error: error.message || error,
    });
    // In production, this can also trigger a slack/email webhook notification:
    const slackWebhook = process.env.SLACK_MONITOR_WEBHOOK;
    if (slackWebhook) {
      try {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *CRITICAL DOWNTIME ALERT* 🚨\nSystem at ${HEALTH_URL} failed healthcheck: ${error.message || error}`
          })
        });
      } catch (slackErr) {
        logger.error({ msg: 'Failed to send slack alert', error: slackErr });
      }
    }
  }
}

logger.info(`Starting uptime monitor daemon targeting ${HEALTH_URL}...`);
setInterval(checkHealth, INTERVAL_MS);
// Run initial check immediately
checkHealth();
