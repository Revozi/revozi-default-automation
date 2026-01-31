const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const quoraAccessToken = process.env.QUORA_ACCESS_TOKEN;
const quoraUserId = process.env.QUORA_USER_ID;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'quora',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[QuoraBot] Supabase log error: ${err.message}`);
  }
}

async function askQuestion() {
  const payload = {
    question: 'What are the best practices for social media automation?',
    topics: ['Social Media', 'Automation', 'Marketing'],
    details: 'I\'m interested in learning about social media automation best practices. What tools and strategies do you recommend?',
    is_anonymous: false
  };

  try {
    const resp = await axios.post(
      'https://www.quora.com/api/1.0/questions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info('[QuoraBot] Question asked successfully');
    await logToSupabase({ action: 'askQuestion', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] askQuestion error: ${msg}`);
    await logToSupabase({ action: 'askQuestion', error: msg });
    throw error;
  }
}

async function answerQuestion(questionId, answerText) {
  const payload = {
    question_id: questionId,
    answer: answerText,
    is_anonymous: false,
    is_public: true
  };

  try {
    const resp = await axios.post(
      'https://www.quora.com/api/1.0/answers',
      payload,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[QuoraBot] Answered question ${questionId}`);
    await logToSupabase({ action: 'answerQuestion', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] answerQuestion error: ${msg}`);
    await logToSupabase({ action: 'answerQuestion', error: msg });
    throw error;
  }
}

async function upvoteAnswer(answerId) {
  const payload = {
    answer_id: answerId,
    action: 'upvote'
  };

  try {
    const resp = await axios.post(
      'https://www.quora.com/api/1.0/answers/vote',
      payload,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[QuoraBot] Upvoted answer ${answerId}`);
    await logToSupabase({ action: 'upvoteAnswer', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] upvoteAnswer error: ${msg}`);
    await logToSupabase({ action: 'upvoteAnswer', error: msg });
    throw error;
  }
}

async function followTopic(topicName) {
  const payload = {
    topic_name: topicName
  };

  try {
    const resp = await axios.post(
      'https://www.quora.com/api/1.0/topics/follow',
      payload,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[QuoraBot] Following topic: ${topicName}`);
    await logToSupabase({ action: 'followTopic', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] followTopic error: ${msg}`);
    await logToSupabase({ action: 'followTopic', error: msg });
    throw error;
  }
}

async function getProfile() {
  try {
    const resp = await axios.get(
      `https://www.quora.com/api/1.0/users/${quoraUserId}`,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`
        }
      }
    );
    logger.info('[QuoraBot] Profile retrieved successfully');
    await logToSupabase({ action: 'getProfile', response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] getProfile error: ${msg}`);
    await logToSupabase({ action: 'getProfile', error: msg });
    throw error;
  }
}

async function getQuestions(topic = 'Technology') {
  try {
    const resp = await axios.get(
      `https://www.quora.com/api/1.0/questions?topic=${encodeURIComponent(topic)}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`
        }
      }
    );
    logger.info(`[QuoraBot] Retrieved questions for topic: ${topic}`);
    await logToSupabase({ action: 'getQuestions', topic, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] getQuestions error: ${msg}`);
    await logToSupabase({ action: 'getQuestions', error: msg });
    throw error;
  }
}

async function shareAnswer(answerId, platforms = ['twitter', 'linkedin']) {
  const payload = {
    answer_id: answerId,
    platforms: platforms
  };

  try {
    const resp = await axios.post(
      'https://www.quora.com/api/1.0/answers/share',
      payload,
      {
        headers: {
          Authorization: `Bearer ${quoraAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[QuoraBot] Shared answer ${answerId} to ${platforms.join(', ')}`);
    await logToSupabase({ action: 'shareAnswer', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[QuoraBot] shareAnswer error: ${msg}`);
    await logToSupabase({ action: 'shareAnswer', error: msg });
    throw error;
  }
}

async function runQuoraBot() {
  logger.info('[QuoraBot] Starting automation task');
  if (!quoraAccessToken || !quoraUserId) {
    const msg = '[QuoraBot] QUORA_ACCESS_TOKEN or QUORA_USER_ID not set';
    logger.error(msg);
    await logToSupabase({ action: 'runQuoraBot', error: msg });
    return;
  }

  try {
    // Get profile info
    await getProfile();
    
    // Ask a question
    await askQuestion();
    
    // Follow a topic
    await followTopic('Social Media Marketing');
    
    // Get questions for a topic
    await getQuestions('Automation');
    
    logger.info('[QuoraBot] Task complete');
    await logToSupabase({ action: 'runQuoraBot', status: 'complete' });
  } catch (error) {
    // Already logged in individual functions
  }
}

module.exports = runQuoraBot;
