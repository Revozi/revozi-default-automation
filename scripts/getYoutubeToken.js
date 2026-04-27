const { google } = require('googleapis');
const readline = require('readline');

// Replace these with your actual credentials
const CLIENT_ID = '763038897891-4tlq4d17brdf1l6tib8rhut5agv40nof.apps.googleusercontent.com';
const CLIENT_SECRET = 'PASTE_YOUR_CLIENT_SECRET_HERE'; // Get from Google Console
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('\n========================================');
console.log('YOUTUBE TOKEN SETUP');
console.log('========================================\n');
console.log('1. Visit this URL:\n');
console.log(authUrl);
console.log('\n2. Authorize the app');
console.log('3. Copy the code from the page\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Paste the authorization code here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n========================================');
    console.log('SUCCESS! Add these to Railway:');
    console.log('========================================\n');
    console.log(`YOUTUBE_ACCESS_TOKEN=${tokens.access_token}`);
    if (tokens.refresh_token) {
      console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    }
    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
  }
  rl.close();
});
