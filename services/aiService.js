const fallbackPrompts = require('./fallbackPrompts'); 
const { supabase } = require('./pgClient');
const { openai } = require('./openaiClient');
const logger = require('../utils/logger');
const { translateText, batchTranslate, supportedLangs } = require('../utils/translate');
const geoip = require('geoip-lite');
const marked = require('marked');

// Map of country codes to emoji flags and localized messages
const geoMessages = {
  IN: { emoji: '🇮🇳', messages: {
    en: 'Special for India',
    hi: 'भारत के लिए विशेष',
    es: 'Especial para India'
  }},
  US: { emoji: '🇺🇸', messages: {
    en: 'Made for USA',
    hi: 'अमेरिका के लिए',
    es: 'Hecho para EE.UU.'
  }},
  MX: { emoji: '🇲🇽', messages: {
    en: 'Perfect for Mexico',
    hi: 'मेक्सिको के लिए',
    es: '¡Perfecto para México!'
  }}
};

/**
 * Generate transcript/summary of content
 * @param {string} content - Content to summarize
 * @param {string} lang - Language code
 * @returns {Promise<string>} - Summarized content
 */
const retry = require('../utils/retry');

async function generateTranscript(content, lang = 'en') {
  try {
    const messages = [
      {
        role: 'system',
        content: `Summarize the following ${lang} text in less than 200 words, preserving key points and tone.`
      },
      {
        role: 'user',
        content: content
      }
    ];

    const completion = await retry(() => openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.3,
      max_tokens: 400,
    }), 2, 200);

    return completion?.data?.choices?.[0]?.message?.content?.trim()
      || completion?.choices?.[0]?.message?.content?.trim()
      || content.substring(0, 200) + '...';
  } catch (error) {
    logger.error('Transcript generation failed', { error: error.message });
    return content.substring(0, 200) + '...'; // Fallback to truncation
  }
}

/**
 * Generate geo-aware messages based on region
 * @param {string} countryCode - ISO country code
 * @param {string[]} langs - Target languages
 * @returns {Object} - Geo-aware messages by language
 */
function generateGeoAware(countryCode, langs = supportedLangs) {
  const country = geoMessages[countryCode] || geoMessages.US; // Default to US
  return langs.reduce((acc, lang) => {
    acc[lang] = `${country.emoji} ${country.messages[lang] || country.messages.en}`;
    return acc;
  }, {});
}

function stripCodeFence(text = '') {
  return String(text)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonPayload(raw) {
  return JSON.parse(stripCodeFence(raw));
}

function buildYoutubeFallbackPackage(finalPrompt, geo = 'US') {
  const geoAware = generateGeoAware(geo, ['en']).en;
  const title = 'Turn Customer Reviews Into Revenue With Revozi';
  const description = [
    'See how Revozi helps SaaS teams triage Google Reviews, uncover product insights, and draft high-quality responses without manual busywork.',
    `Built for founders, customer success, and product teams who want faster action from customer feedback. ${geoAware}. Learn more at revozi.com.`
  ].join('\n\n');

  return {
    topicAngle: finalPrompt,
    title,
    description,
    tags: ['Revozi', 'Google Reviews', 'SaaS', 'Customer Feedback', 'AI Automation', 'Reputation Management'],
    caption: 'Every review contains revenue signals, churn warnings, and product insight. Revozi helps SaaS teams catch all three by triaging Google Reviews with AI, surfacing trends, and drafting thoughtful responses in minutes instead of hours.',
    videoPrompt: `A polished 10-second B2B SaaS explainer video for Revozi. Start with a founder or customer success lead noticing a negative Google Review, then cut to a modern review-management dashboard with sentiment analysis, issue triage, and AI-drafted replies. End with a confident team seeing ratings improve and customer feedback turned into product insight. Clean cinematic lighting, premium SaaS visuals, smooth camera motion, blue-teal product palette, realistic UI motion, no on-screen text.`,
    negativePrompt: 'low quality, blurry, unreadable text, subtitles, captions, watermarks, logos, warped UI, flicker, jitter, distorted faces, duplicate people',
    duration: 10,
    aspectRatio: '16:9',
    extras: {
      generatedAt: new Date().toISOString(),
      geo,
      geoAware
    }
  };
}

/**
 * Generate multi-language captions with transcripts and geo-awareness
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} - Generated content with translations
 */
async function generateCaption({ prompt, platform, languages = supportedLangs, geo = 'US' }) {
  const platformFallback = fallbackPrompts[platform];
  const finalPrompt =
    (prompt || '').trim() || platformFallback || fallbackPrompts.default;

  if (!finalPrompt) {
    logger.error(`[AI] No valid prompt for platform: ${platform}`);
    throw new Error('Missing prompt and fallback');
  }

  try {
    // Check cache first
    const { data: cached } = await supabase
      .from('ai_outputs')
      .select('output')
      .eq('prompt', finalPrompt)
      .eq('platform', platform)
      .limit(1)
      .maybeSingle();

    if (cached?.output) {
      logger.info(`[AI_CACHE] Used cached multi-lang caption`);
      return cached.output;
    }
  } catch (err) {
    logger.error(`[AI_CACHE] Cache error: ${err.message}`);
  }

  try {
    // Generate base English caption
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a social media expert for Revozi — an AI-powered review management platform built for SaaS teams. Revozi automates Google Reviews management: it triages incoming reviews, analyzes customer feedback with AI, and drafts personalized responses so teams never miss a review. Always write content that promotes the Revozi brand and its mission to help SaaS companies protect their reputation and turn customer feedback into growth. Never mention any other brand name. Keep content authentic, engaging, and platform-appropriate.`
        },
        {
          role: 'user',
          content: `Generate an engaging ${platform} caption for: ${finalPrompt}\n\nCaption:`
        }
      ],
      temperature: 0.7
    });

    const enCaption = aiResponse?.choices?.[0]?.message?.content?.trim();
    if (!enCaption) throw new Error('AI response is empty');

    // Translate to all target languages in parallel
    const captions = await batchTranslate(enCaption, languages);
    
    // Generate transcripts for each language
    const transcripts = {};
    for (const lang of languages) {
      transcripts[lang] = await generateTranscript(captions[lang], lang);
    }

    // Add geo-aware content
    const geoAware = generateGeoAware(geo, languages);

    const output = {
      captions,
      transcripts,
      extras: {
        geoAware,
        generatedAt: new Date().toISOString(),
        platform
      }
    };

    // Cache the result
    await supabase.from('ai_outputs').insert({
      platform,
      prompt: finalPrompt,
      output
    });

    return output;
  } catch (err) {
    logger.error(`[AI_GENERATE] Error generating multi-lang caption: ${err.message}`);
    throw new Error('AI caption generation failed');
  }
}

async function generateYoutubeVideoPackage({ prompt, geo = 'US' }) {
  const platform = 'youtube';
  const finalPrompt =
    (prompt || '').trim() || fallbackPrompts.youtube || fallbackPrompts.default;

  if (!finalPrompt) {
    logger.error('[YOUTUBE_AI] No valid prompt for YouTube package');
    throw new Error('Missing YouTube prompt');
  }

  try {
    const { data: cached } = await supabase
      .from('ai_outputs')
      .select('output')
      .eq('prompt', finalPrompt)
      .eq('platform', 'youtube_video')
      .limit(1)
      .maybeSingle();

    if (cached?.output) {
      logger.info('[YOUTUBE_AI] Used cached YouTube video package');
      return cached.output;
    }
  } catch (err) {
    logger.warn(`[YOUTUBE_AI] Cache lookup error: ${err.message}`);
  }

  const geoAware = generateGeoAware(geo, ['en']).en;

  try {
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are the creative director and growth marketer for Revozi, an AI-powered review management platform for SaaS teams. Revozi helps teams triage Google Reviews, identify product and churn signals, and draft thoughtful review responses fast. Create premium, insight-driven YouTube content ideas that feel like high-quality B2B SaaS marketing, not generic AI slop. Always return strict JSON only.`
        },
        {
          role: 'user',
          content: `Create one Revozi YouTube auto-post package for this topic: "${finalPrompt}".

Context:
- Audience: SaaS founders, customer success leaders, product managers, growth teams
- Region note: ${geoAware}
- Video target: 10-second cinematic explainer clip for a YouTube upload
- Product truth: Revozi focuses on Google Reviews automation, customer feedback analysis, and AI-assisted response drafting

Return JSON with exactly these keys:
{
  "topicAngle": string,
  "title": string,
  "description": string,
  "tags": string[],
  "caption": string,
  "videoPrompt": string,
  "negativePrompt": string,
  "duration": number,
  "aspectRatio": string
}

Rules:
- title: under 70 characters, specific and strong
- description: 2 short paragraphs, polished, product-led, clear CTA to revozi.com
- tags: 6 to 10 concise tags
- caption: 60 to 90 words, suitable as narration/supporting copy
- videoPrompt: one vivid paragraph optimized for text-to-video, showing realistic SaaS scenes, review triage, dashboards, product insight, and team action
- videoPrompt must explicitly avoid cheesy stock-ad style and should say no on-screen text
- negativePrompt: compact list of things to avoid
- duration: set to 10
- aspectRatio: set to "16:9"
- Never mention competitors or any brand other than Revozi`
        }
      ],
      temperature: 0.8
    });

    const raw = aiResponse?.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error('AI response is empty');

    const parsed = parseJsonPayload(raw);
    const fallback = buildYoutubeFallbackPackage(finalPrompt, geo);
    const output = {
      topicAngle: parsed.topicAngle || finalPrompt,
      title: String(parsed.title || '').trim() || fallback.title,
      description: String(parsed.description || '').trim() || fallback.description,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 10)
        : fallback.tags,
      caption: String(parsed.caption || '').trim() || fallback.caption,
      videoPrompt: String(parsed.videoPrompt || '').trim() || fallback.videoPrompt,
      negativePrompt: String(parsed.negativePrompt || '').trim() || fallback.negativePrompt,
      duration: 10,
      aspectRatio: '16:9',
      extras: {
        generatedAt: new Date().toISOString(),
        geo,
        geoAware
      }
    };

    await supabase.from('ai_outputs').insert({
      platform: 'youtube_video',
      prompt: finalPrompt,
      output
    });

    return output;
  } catch (err) {
    logger.error(`[YOUTUBE_AI] Error generating package: ${err.message}`);
    return buildYoutubeFallbackPackage(finalPrompt, geo);
  }
}

/**
 * Generate multi-language blog content with transcripts and geo-awareness
 * @param {Object} params - Blog generation parameters
 * @returns {Promise<Object>} - Generated blog content with translations
 */
async function generateBlogContent({ title, prompt, languages = supportedLangs, geo = 'US', tags = [] }) {
  const finalPrompt = (prompt || '').trim() || fallbackPrompts.default;
  const finalTitle = (title || '').trim() || finalPrompt;

  if (!finalPrompt) {
    logger.error(`[BLOG_AI] No valid blog prompt`);
    throw new Error('Missing blog prompt');
  }

  // Check cache first
  try {
    const { data: cached } = await supabase
      .from('ai_outputs')
      .select('output')
      .eq('prompt', finalPrompt)
      .eq('platform', 'blog')
      .limit(1)
      .maybeSingle();

    if (cached?.output) {
      logger.info(`[BLOG_CACHE] Used cached multi-lang blog content`);
      return cached.output;
    }
  } catch (err) {
    logger.warn(`[BLOG_CACHE] Cache lookup error: ${err.message}`);
  }

  try {
    // Generate English content first
    const messages = [
      {
        role: 'system',
        content: `You are an expert SEO blogger. Write a full blog post in markdown based on the user's topic. Include headings, subheadings, and make it structured, informative, and engaging.`,
      },
      {
        role: 'user',
        content: `Write a blog post about: "${finalPrompt}"
        
Title: ${finalTitle}

Write in markdown format. Include headings, paragraphs, and bullet points where appropriate.

Blog Post:`,
      },
    ];

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.75,
      max_tokens: 2000
    });

    const enContent = aiResponse?.choices?.[0]?.message?.content?.trim();
    if (!enContent) throw new Error('Empty blog generation');

    // Convert markdown to HTML
    const contentHtml = marked.parse(enContent);
    
    // Extract description (first 150 chars of plain text)
    const description = enContent
      .replace(/#+\s/g, '') // Remove markdown headings
      .substring(0, 150)
      .trim() + '...';

    // Translate all content in parallel
    const [
      titles,
      descriptions,
      contents,
      htmlContents,
      translatedTags
    ] = await Promise.all([
      batchTranslate(finalTitle, languages),
      batchTranslate(description, languages),
      batchTranslate(enContent, languages),
      batchTranslate(contentHtml, languages),
      Promise.all(tags.map(tag => batchTranslate(tag, languages)))
    ]);

    // Generate transcripts
    const transcripts = {};
    for (const lang of languages) {
      transcripts[lang] = await generateTranscript(contents[lang], lang);
    }

    // Add geo-aware content
    const geoAware = generateGeoAware(geo, languages);

    // Structure multi-language tags
    const tagsByLang = languages.reduce((acc, lang) => {
      acc[lang] = tags.map((_, i) => translatedTags[i][lang]);
      return acc;
    }, {});

    // Structure the multi-language content
    const output = {
      metadata: {
        title: titles,
        description: descriptions,
        content_markdown: contents,
        content_html: htmlContents,
        tags: tagsByLang,
        transcript: transcripts
      },
      extras: {
        geoAware,
        generatedAt: new Date().toISOString()
      }
    };

    // Cache the result
    await supabase.from('ai_outputs').insert({
      platform: 'blog',
      prompt: finalPrompt,
      output: output
    });

    return output;
  } catch (error) {
    logger.error('Blog generation failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateCaption,
  generateYoutubeVideoPackage,
  generateBlogContent,
  generateTranscript,
  generateGeoAware
};
