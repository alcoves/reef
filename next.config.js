console.log({ BKEN_ENV: process.env.BKEN_ENV });

module.exports = {
  target: 'serverless',
  env: { BKEN_ENV: process.env.BKEN_ENV },
};
