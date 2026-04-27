const runYoutubeBot = require('../bots/youtubeBot');

// Test with a sample video (you'll need to provide actual video path)
runYoutubeBot({
  videoPath: '/path/to/test/video.mp4',
  title: 'Test Upload from Revozi Bot',
  description: 'Testing automated YouTube uploads',
  tags: ['automation', 'test']
}).then(() => {
  console.log('Test complete!');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
