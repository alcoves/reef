const _ = require('lodash');
const Video = require('./model');
const User = require('../users/model');
const ds3 = require('../../utils/ds3');
const ws3 = require('../../utils/ws3');

async function getVideosByUsername(username) {
  const dbUser = await User.findOne({ username });
  return Video.find({
    user: dbUser.id,
    visibility: 'public',
  }).sort({ createdAt: -1 });
}

async function getTidalThumbnailsById(id) {
  const res = await ws3
    .listObjectsV2({ Bucket: 'cdn.bken.io', Prefix: `i/${id}/t/` })
    .promise();
  if (!res.Contents.length)
    return ['https://cdn.bken.io/files/default-thumbnail-sm.jpg'];
  return res.Contents.reduce((acc, { Key }) => {
    if (!Key.endsWith('/')) acc.push(`https://cdn.bken.io/${Key}`);
    return acc;
  }, []);
}

async function deleteVideoById(id) {
  if (id) {
  // TODO :: make sure that tidal is not processing before deleting
    const Bucket = 'cdn.bken.io';
    const [imageRes, videoRes] = await Promise.all([
      ws3.listObjectsV2({ Bucket, Prefix: `i/${id}` }).promise(),
      ws3.listObjectsV2({ Bucket, Prefix: `v/${id}` }).promise(),
    ]);
    
    const itemsToDelete = _.union(imageRes.Contents, videoRes.Contents);
    
    await Promise.all(
      itemsToDelete.map(({ Key }) => {
        return ws3.deleteObject({ Bucket, Key }).promise();
      })
    );
    
    await Video.deleteOne({ _id: id });
    return true;
  }
  
  return null;
}

async function getTidalVersionsById(id) {
  // Should fetch more items, 1000 limit right now
  const [tidalPresets, totalSegments, publishedVersions] = await Promise.all([
    ds3
      .listObjectsV2({
        Bucket: 'tidal',
        Delimiter: '/',
        Prefix: `${id}/versions/`,
      })
      .promise()
      .then(({ CommonPrefixes }) => {
        return CommonPrefixes.map(
          ({ Prefix }) => Prefix.split('/')[2].split('/')[0]
        );
      }),
    ds3
      .listObjectsV2({
        Bucket: 'tidal',
        Prefix: `${id}/segments/`,
      })
      .promise()
      .then(({ Contents }) => {
        return Contents.length;
      }),
    ws3.getObject({
      Bucket: 'cdn.bken.io',
      Key: `v/${id}/hls/master.m3u8`,
    }).promise().then(({ Body }) => {
      return Body.toString().split('\n').reduce((acc, l) => {
        if (l.includes('NAME=')) acc.push(l.split('NAME=')[1].split(',')[0]);
        return acc;
      }, []);
    }).catch(() => {
      return [];
    }),
  ]);

  const versions = await Promise.all(
    _.union(tidalPresets, publishedVersions).map(async (preset) => {
      const completedSegments = await ds3
        .listObjectsV2({ Bucket: 'tidal', Prefix: `${id}/versions/${preset}/segments/` })
        .promise()
        .then(({ Contents }) =>
          Contents.filter(({ Key }) => !Key.endsWith('/'))
        );

      const percentCompletedCalc = (completedSegments.length / totalSegments) * 100;
      const percentCompleted = isNaN(percentCompletedCalc) ? 0 : percentCompletedCalc;
  
      return {
        preset,
        status: publishedVersions.includes(preset) ? 'completed' : 'processing',
        percentCompleted: publishedVersions.includes(preset) ? 100 : percentCompleted,
      };
    })
  );

  versions.sort((a, b) => (parseInt(a.preset) > parseInt(b.preset)) ? -1 : 1);
  
  let status;
  
  if (!versions.filter(({ percentCompleted }) => percentCompleted).length) {
    status = 'segmenting';
  } else if (
    publishedVersions.filter((preset) => publishedVersions.includes(preset))
      .length === versions.length
  ) {
    status = 'completed';
  } else {
    status = 'processing';
  }
  
  return { status, link: `https://cdn.bken.io/v/${id}/hls/master.m3u8`, versions };
}

module.exports = {
  deleteVideoById,
  getVideosByUsername,
  getTidalVersionsById,
  getTidalThumbnailsById,
};