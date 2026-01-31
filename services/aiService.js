const fallbackPrompts = require('./fallbackPrompts'); 
const { supabase } = require('./supabaseClient');
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
      messages: [{ 
        role: 'user', 
        content: `Generate an engaging ${platform} caption for: ${finalPrompt}\n\nCaption:` 
      }],
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
  generateBlogContent,
  generateTranscript,
  generateGeoAware
};