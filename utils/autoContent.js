/**
 * autoContent.js
 * Auto-generates Revozi branded content for any platform
 * using OpenAI when the post_queue is empty.
 */

const { generateCaption, generateYoutubeVideoPackage } = require('../services/aiService');
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
  'How Revozi helps SaaS teams manage Google Reviews on autopilot with AI',
  'Stop losing customers to bad reviews — Revozi triage and responds before it hurts your rating',
  'Why AI-powered review management is the competitive edge every SaaS company needs in 2025',
  'Revozi turns your Google Reviews into actionable product insights automatically',
  'How Revozi drafts personalized review responses in seconds so your team never misses one',
  'The hidden cost of ignoring Google Reviews — and how Revozi solves it for SaaS teams',
  'Revozi: from review chaos to full visibility — automated feedback analysis for SaaS',
  'How top SaaS companies use Revozi to protect their reputation and grow 5-star ratings',
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
    if (platform === 'youtube') {
      const pkg = await generateYoutubeVideoPackage({ prompt: topic });
      logger.info(`[AutoContent] Generated YouTube package: "${pkg.title}"`);
      return {
        caption: pkg.caption,
        title: pkg.title,
        description: pkg.description,
        tags: pkg.tags,
        video_prompt: pkg.videoPrompt,
        negative_prompt: pkg.negativePrompt,
        duration: pkg.duration,
        aspect_ratio: pkg.aspectRatio,
        topic_angle: pkg.topicAngle,
        extras: pkg.extras
      };
    }

    const result = await generateCaption({ prompt: topic, platform });
    const caption = result?.captions?.en || Object.values(result?.captions || {})[0] || topic;
    const media_url = nextMediaUrl();
    logger.info(`[AutoContent] Generated caption for ${platform}: "${caption.substring(0, 80)}..."`);
    return { caption, media_url };
  } catch (err) {
    logger.error(`[AutoContent] AI generation failed for ${platform}: ${err.message}. Using topic as fallback.`);
    if (platform === 'youtube') {
      return {
        caption: `${topic} Learn how Revozi helps SaaS teams triage reviews, surface customer signals, and draft thoughtful responses faster at revozi.com.`,
        title: 'How Revozi Turns Reviews Into SaaS Growth',
        description: 'Revozi helps SaaS teams manage Google Reviews with AI-powered triage, insight extraction, and smart response drafting.\n\nSee how customer feedback becomes action at revozi.com.',
        tags: ['Revozi', 'SaaS', 'Google Reviews', 'AI Automation', 'Customer Feedback'],
        video_prompt: `A premium 10-second Revozi explainer video showing a SaaS team moving from review chaos to clarity with AI triage, customer feedback insights, and response drafting inside a modern dashboard. Realistic office scenes, elegant UI motion, blue-teal palette, no on-screen text.`,
        negative_prompt: 'low quality, blurry, unreadable text, subtitles, watermarks, warped UI, flicker',
        duration: 10,
        aspect_ratio: '16:9'
      };
    }

    return {
      caption: `${topic} — Learn more at revozi.com 🚀 #Revozi #AI #BusinessAutomation`,
      media_url: nextMediaUrl(),
    };
  }
}

module.exports = { autoGenerateContent };
