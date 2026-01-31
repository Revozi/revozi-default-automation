# Social Media Automation Platform Setup Guide

This document provides comprehensive setup instructions for all supported social media platforms in the Default Automation system.

## Supported Platforms

The system now supports **12 social media platforms**:

### Original Platforms
- ✅ Instagram
- ✅ Twitter/X
- ✅ TikTok
- ✅ Facebook
- ✅ Reddit
- ✅ Telegram
- ✅ Pinterest
- ✅ Google My Business (GMB)

### Newly Added Platforms
- 🆕 Snapchat
- 🆕 LinkedIn
- 🆕 Quora
- 🆕 Discord

## Environment Variables Setup

Create a `.env` file in your project root with the following variables:

### Core System Variables
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_api_token

# Media Generation
ENABLE_IMAGE_GEN=true
ENABLE_VIDEO_GEN=true
MAX_RETRIES=3
```

### Platform-Specific API Keys

#### Instagram
```bash
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_USER_ID=your_instagram_user_id
```

#### Twitter/X
```bash
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_USER_ID=your_twitter_user_id
```

#### TikTok
```bash
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token
TIKTOK_OPEN_ID=your_tiktok_open_id
```

#### Facebook
```bash
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
FACEBOOK_PAGE_ID=your_facebook_page_id
```

#### Reddit
```bash
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

#### Telegram
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

#### Pinterest
```bash
PINTEREST_ACCESS_TOKEN=your_pinterest_access_token
PINTEREST_BOARD_ID=your_pinterest_board_id
```

#### Google My Business
```bash
GMB_ACCESS_TOKEN=your_gmb_access_token
GMB_ACCOUNT_ID=your_gmb_account_id
```

#### Snapchat (NEW)
```bash
SNAPCHAT_ACCESS_TOKEN=your_snapchat_access_token
SNAPCHAT_AD_ACCOUNT_ID=your_snapchat_ad_account_id
```

#### LinkedIn (NEW)
```bash
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token
LINKEDIN_PERSON_URN=your_linkedin_person_urn
```

#### Quora (NEW)
```bash
QUORA_ACCESS_TOKEN=your_quora_access_token
QUORA_USER_ID=your_quora_user_id
```

#### Discord (NEW)
```bash
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_guild_id
DISCORD_CHANNEL_ID=your_discord_channel_id
```

## Platform-Specific Setup Instructions

### Snapchat Setup
1. Go to [Snapchat Ads Manager](https://ads.snapchat.com/)
2. Create an ad account
3. Generate an access token
4. Note your ad account ID

### LinkedIn Setup
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create a new app
3. Request the required permissions (w_member_social, r_liteprofile)
4. Generate an access token
5. Get your person URN from the API

### Quora Setup
1. Go to [Quora Developer Portal](https://www.quora.com/developers)
2. Create a new application
3. Generate an access token
4. Note your user ID

### Discord Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Invite the bot to your server with necessary permissions
6. Get your guild (server) ID and channel ID

## Bot Scheduling

The system uses cron jobs to automatically run bots at scheduled intervals:

### Current Schedule
- **Instagram**: Every 15 minutes (`*/15 * * * *`)
- **Twitter**: At 5 and 35 minutes past the hour (`5,35 * * * *`)
- **TikTok**: At 10 and 40 minutes past the hour (`10,40 * * * *`)
- **Facebook**: At 25 and 55 minutes past the hour (`25,55 * * * *`)
- **Reddit**: At 30 minutes past the hour (`30 * * * *`)
- **Telegram**: At 20 minutes past the hour (`20 * * * *`)
- **Pinterest**: At 50 minutes past the hour (`50 * * * *`)
- **GMB**: At 45 minutes past the hour (`45 * * * *`)
- **Snapchat**: At 0 and 30 minutes past the hour (`0,30 * * * *`)
- **LinkedIn**: At 15 and 45 minutes past the hour (`15,45 * * * *`)
- **Quora**: At 10 and 50 minutes past the hour (`10,50 * * * *`)
- **Discord**: At 5 and 25 minutes past the hour (`5,25 * * * *`)

## Admin Interface Features

The admin interface (`/admin`) now includes:

### New Platform Support
- ✅ Platform filters for all 12 platforms
- ✅ Bot management cards for each platform
- ✅ Individual bot controls (run, logs, settings)
- ✅ Cron schedule management
- ✅ Platform-specific analytics

### Enhanced Features
- 📊 Real-time bot status monitoring
- 🔄 Automated retry mechanisms
- 📈 Engagement tracking across all platforms
- 🎯 Content scheduling and queue management
- 🤖 AI-powered caption generation
- 🖼️ Media generation (images/videos)

## API Endpoints

### Bot Management
- `POST /admin/bots/{platform}/run` - Run a specific bot
- `GET /admin/bots/status` - Get status of all bots
- `POST /admin/cron/restart` - Restart all cron jobs

### Post Management
- `POST /admin/schedule-post` - Schedule a post to multiple platforms
- `GET /admin/posts/queue` - Get post queue
- `POST /admin/posts/retry-failed` - Retry all failed posts

### Analytics
- `GET /admin/engagement-stats` - Get engagement statistics
- `GET /admin/reward-stats` - Get reward statistics
- `GET /admin/top-users` - Get top performing users

## Database Schema

The system uses Supabase with the following key tables:

### Core Tables
- `post_queue` - Scheduled posts
- `generated_posts` - AI-generated content
- `engagements` - Platform engagement data
- `rewards` - User rewards system
- `notifications` - System notifications

### Platform-Specific Data
All platforms log their activities to the `engagements` table with:
- Platform name
- Action performed
- Response data
- Timestamps
- Error logs (if any)

## Troubleshooting

### Common Issues

1. **Bot Not Running**
   - Check environment variables are set correctly
   - Verify API tokens are valid and have proper permissions
   - Check logs in the admin interface

2. **API Rate Limits**
   - The system includes built-in rate limiting
   - Adjust cron schedules if needed
   - Monitor API usage in platform dashboards

3. **Media Generation Failures**
   - Ensure Replicate API token is valid
   - Check if image/video generation is enabled
   - Verify media prompts are appropriate

### Logs and Monitoring

- All bot activities are logged to Supabase
- Admin interface provides real-time monitoring
- System logs are available in the Settings section
- Individual bot logs can be viewed from bot management cards

## Security Considerations

1. **API Keys**: Store all API keys securely in environment variables
2. **Permissions**: Use minimal required permissions for each platform
3. **Rate Limiting**: Respect platform rate limits
4. **Data Privacy**: Ensure compliance with platform terms of service
5. **Access Control**: Admin interface should be protected with authentication

## Support and Maintenance

### Regular Maintenance
- Monitor bot performance weekly
- Update API tokens before expiration
- Review and optimize cron schedules
- Clean up old logs and data

### Updates
- The system is designed to be easily extensible
- New platforms can be added by following the existing bot pattern
- All bots follow the same structure for consistency

## Getting Started

1. Set up all required environment variables
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Access admin interface: `http://localhost:3000/admin`
5. Configure bot settings and schedules
6. Test individual bots before enabling full automation

For additional support or feature requests, please refer to the project documentation or contact the development team.
