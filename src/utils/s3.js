const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-2',
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  maxRetries: 8,
  httpOptions: {
    timeout: 5000,
    connectTimeout: 3000,
  },
});

const s3 = new AWS.S3({
  signatureVersion: 'v4',
  endpoint: process.env.WASABI_ENDPOINT
});

module.exports = { s3 };