const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
const discordGuildId = process.env.DISCORD_GUILD_ID;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'discord',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[DiscordBot] Supabase log error: ${err.message}`);
  }
}

async function sendMessage(channelId, content, embed = null) {
  const payload = {
    content: content
  };

  if (embed) {
    payload.embeds = [embed];
  }

  try {
    const resp = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[DiscordBot] Message sent to channel ${channelId}`);
    await logToSupabase({ action: 'sendMessage', channelId, content, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] sendMessage error: ${msg}`);
    await logToSupabase({ action: 'sendMessage', error: msg });
    throw error;
  }
}

async function createEmbed(title, description, color = 0x00ff00, fields = []) {
  const embed = {
    title: title,
    description: description,
    color: color,
    timestamp: new Date().toISOString(),
    fields: fields,
    footer: {
      text: 'Automated by Discord Bot'
    }
  };

  return embed;
}

async function sendEmbedMessage(channelId, embed) {
  try {
    const resp = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        embeds: [embed]
      },
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[DiscordBot] Embed message sent to channel ${channelId}`);
    await logToSupabase({ action: 'sendEmbedMessage', channelId, embed, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] sendEmbedMessage error: ${msg}`);
    await logToSupabase({ action: 'sendEmbedMessage', error: msg });
    throw error;
  }
}

async function reactToMessage(channelId, messageId, emoji) {
  try {
    const resp = await axios.put(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`,
      {},
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`
        }
      }
    );
    logger.info(`[DiscordBot] Reacted to message ${messageId} with ${emoji}`);
    await logToSupabase({ action: 'reactToMessage', channelId, messageId, emoji, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] reactToMessage error: ${msg}`);
    await logToSupabase({ action: 'reactToMessage', error: msg });
    throw error;
  }
}

async function createChannel(guildId, name, type = 0) {
  const payload = {
    name: name,
    type: type
  };

  try {
    const resp = await axios.post(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      payload,
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[DiscordBot] Channel created: ${name}`);
    await logToSupabase({ action: 'createChannel', guildId, name, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] createChannel error: ${msg}`);
    await logToSupabase({ action: 'createChannel', error: msg });
    throw error;
  }
}

async function getGuildInfo(guildId) {
  try {
    const resp = await axios.get(
      `https://discord.com/api/v10/guilds/${guildId}`,
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`
        }
      }
    );
    logger.info(`[DiscordBot] Guild info retrieved for ${guildId}`);
    await logToSupabase({ action: 'getGuildInfo', guildId, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] getGuildInfo error: ${msg}`);
    await logToSupabase({ action: 'getGuildInfo', error: msg });
    throw error;
  }
}

async function getChannelMessages(channelId, limit = 10) {
  try {
    const resp = await axios.get(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`
        }
      }
    );
    logger.info(`[DiscordBot] Retrieved ${limit} messages from channel ${channelId}`);
    await logToSupabase({ action: 'getChannelMessages', channelId, limit, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] getChannelMessages error: ${msg}`);
    await logToSupabase({ action: 'getChannelMessages', error: msg });
    throw error;
  }
}

async function updateBotStatus(status, activity) {
  const payload = {
    status: status, // online, idle, dnd, invisible
    activities: [{
      name: activity,
      type: 0 // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching
    }]
  };

  try {
    const resp = await axios.patch(
      'https://discord.com/api/v10/users/@me/settings',
      payload,
      {
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[DiscordBot] Bot status updated: ${status} - ${activity}`);
    await logToSupabase({ action: 'updateBotStatus', status, activity, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[DiscordBot] updateBotStatus error: ${msg}`);
    await logToSupabase({ action: 'updateBotStatus', error: msg });
    throw error;
  }
}

async function runDiscordBot() {
  logger.info('[DiscordBot] Starting automation task');
  if (!discordBotToken) {
    const msg = '[DiscordBot] DISCORD_BOT_TOKEN not set';
    logger.error(msg);
    await logToSupabase({ action: 'runDiscordBot', error: msg });
    return;
  }

  try {
    // Update bot status
    await updateBotStatus('online', 'Automating social media');
    
    // Get guild info if guild ID is provided
    if (discordGuildId) {
      await getGuildInfo(discordGuildId);
    }
    
    // Send a message if channel ID is provided
    if (discordChannelId) {
      const embed = await createEmbed(
        '🤖 Bot Automation Update',
        'Hello! This is an automated message from our Discord bot. The automation system is running smoothly!',
        0x00ff00,
        [
          { name: 'Status', value: 'Online', inline: true },
          { name: 'Platform', value: 'Discord', inline: true },
          { name: 'Time', value: new Date().toLocaleString(), inline: true }
        ]
      );
      
      await sendEmbedMessage(discordChannelId, embed);
      
      // Send a regular message
      await sendMessage(discordChannelId, '🚀 Automation system is active and monitoring all platforms!');
    }
    
    logger.info('[DiscordBot] Task complete');
    await logToSupabase({ action: 'runDiscordBot', status: 'complete' });
  } catch (error) {
    // Already logged in individual functions
  }
}

module.exports = runDiscordBot;
