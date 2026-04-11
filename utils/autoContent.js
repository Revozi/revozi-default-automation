/**
 * autoContent.js
 * Auto-generates Revozi branded content for any platform
 * using OpenAI when the post_queue is empty.
 */

const { generateCaption } = require('../services/aiService');
const logger = require('./logger');

const MEDIA_POOL = [
  'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080&q=80',
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&q=80',
  'https://images.unsplash.com/photo-1676277791608-ac54983b9b3e?w=1080&q=80',
  'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=1080&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1080&q=80',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1080&q=80',
  'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1080&q=80',
];

const TOPIC_POOL = [
  'How Revozi helps businesses automate repetitive workflows and focus on growth',
  'Why AI-powered business automation is the future — Revozi leads the way',
  'Revozi empowers entrepreneurs to scale their operations without hiring more staff',
  'The story behind Revozi — making business automation accessible to every company',
  'How Revozi is disrupting traditional business software with intelligent AI automation',
  'Save time, reduce costs, and grow faster — the Revozi promise for modern businesses',
  'From manual to automated in minutes — how Revozi transforms business operations',
  'Why thousands of businesses trust Revozi to run their workflows on autopilot',
];

let mediaIndex = Math.floor(Math.random() * MEDIA_POOL.length);
let topicIndex = Math.floor(Math.random() * TOPIC_POOL.length);

function nextMediaUrl() {
  const url = MEDIA_POOL[mediaIndex % MEDIA_POOL.length];
  mediaIndex++;
  return url;
}

function nextTopic() {
  const topic = TOPIC_POOL[topicIndex % TOPIC_POOL.length];
  topicIndex++;
  return topic;
}

async function autoGenerateContent(platform) {
  const topic = nextTopic();
  logger.info(`[AutoContent] Generating content for ${platform}: "${topic.substring(0, 60)}..."`);

  try {
    const result = await generateCaption({ prompt: topic, platform });
    const caption = result?.captions?.en || Object.values(result?.captions || {})[0] || topic;
    const media_url = nextMediaUrl();
    logger.info(`[AutoContent] Generated caption for ${platform}: "${caption.substring(0, 80)}..."`);
    return { caption, media_url };
  } catch (err) {
    logger.error(`[AutoContent] AI generation failed for ${platform}: ${err.message}. Using topic as fallback.`);
    return {
      caption: `${topic} — Learn more at revozi.com 🚀 #Revozi #AI #BusinessAutomation`,
      media_url: nextMediaUrl(),
    };
  }
}

module.exports = { autoGenerateContent };
