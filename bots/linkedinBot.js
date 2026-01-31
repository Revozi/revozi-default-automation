const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN;
const linkedinPersonUrn = process.env.LINKEDIN_PERSON_URN;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'linkedin',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[LinkedInBot] Supabase log error: ${err.message}`);
  }
}

async function createPost() {
  const payload = {
    author: linkedinPersonUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: 'Excited to share this automated post from our bot! 🚀 #automation #linkedin'
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  try {
    const resp = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info('[LinkedInBot] Post created successfully');
    await logToSupabase({ action: 'createPost', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] createPost error: ${msg}`);
    await logToSupabase({ action: 'createPost', error: msg });
    throw error;
  }
}

async function createArticle() {
  const payload = {
    author: linkedinPersonUrn,
    title: 'Automated Article from Bot',
    content: {
      'com.linkedin.ugc.ArticleContent': {
        title: 'Automated Article from Bot',
        description: 'This is an automated article created by our LinkedIn bot. It demonstrates the power of automation in content creation.',
        body: '<p>This is the body of our automated article. It showcases how bots can create engaging content for LinkedIn.</p><p>Automation is the future of social media marketing!</p>'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  try {
    const resp = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info('[LinkedInBot] Article created successfully');
    await logToSupabase({ action: 'createArticle', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] createArticle error: ${msg}`);
    await logToSupabase({ action: 'createArticle', error: msg });
    throw error;
  }
}

async function likePost(postUrn) {
  const payload = {
    actor: linkedinPersonUrn,
    object: postUrn
  };

  try {
    const resp = await axios.post(
      'https://api.linkedin.com/v2/socialActions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info(`[LinkedInBot] Liked post: ${postUrn}`);
    await logToSupabase({ action: 'likePost', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] likePost error: ${msg}`);
    await logToSupabase({ action: 'likePost', error: msg });
    throw error;
  }
}

async function commentOnPost(postUrn, commentText) {
  const payload = {
    actor: linkedinPersonUrn,
    object: postUrn,
    message: {
      text: commentText
    }
  };

  try {
    const resp = await axios.post(
      'https://api.linkedin.com/v2/comments',
      payload,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info(`[LinkedInBot] Commented on post ${postUrn}: ${commentText}`);
    await logToSupabase({ action: 'commentOnPost', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] commentOnPost error: ${msg}`);
    await logToSupabase({ action: 'commentOnPost', error: msg });
    throw error;
  }
}

async function getProfile() {
  try {
    const resp = await axios.get(
      'https://api.linkedin.com/v2/people/~',
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info('[LinkedInBot] Profile retrieved successfully');
    await logToSupabase({ action: 'getProfile', response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] getProfile error: ${msg}`);
    await logToSupabase({ action: 'getProfile', error: msg });
    throw error;
  }
}

async function getAnalytics() {
  try {
    const resp = await axios.get(
      `https://api.linkedin.com/v2/ugcPosts/${linkedinPersonUrn}/analytics`,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );
    logger.info('[LinkedInBot] Analytics retrieved successfully');
    await logToSupabase({ action: 'getAnalytics', response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[LinkedInBot] getAnalytics error: ${msg}`);
    await logToSupabase({ action: 'getAnalytics', error: msg });
    throw error;
  }
}

async function runLinkedInBot() {
  logger.info('[LinkedInBot] Starting automation task');
  if (!linkedinAccessToken || !linkedinPersonUrn) {
    const msg = '[LinkedInBot] LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN not set';
    logger.error(msg);
    await logToSupabase({ action: 'runLinkedInBot', error: msg });
    return;
  }

  try {
    // Get profile info
    await getProfile();
    
    // Create a post
    await createPost();
    
    // Create an article
    await createArticle();
    
    // Get analytics
    await getAnalytics();
    
    logger.info('[LinkedInBot] Task complete');
    await logToSupabase({ action: 'runLinkedInBot', status: 'complete' });
  } catch (error) {
    // Already logged in individual functions
  }
}

module.exports = runLinkedInBot;
