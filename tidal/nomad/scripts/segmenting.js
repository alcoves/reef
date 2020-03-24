const segmenting = require('./handlers/segmenting');

const Bucket = process.argv[2];
const videoId = process.argv[3];
const filename = process.argv[4];
const transcodeQueueUrl = process.argv[5];

(async () => {
  try {
    await segmenting({ Bucket, videoId, filename, transcodeQueueUrl })
  } catch (error) {
    console.error(error)
    process.exit(1);
  }
})()
