const _ = require('lodash');
const Video = require('./model');
const User = require('../users/model');
const ds3 = require('../../utils/ds3');
const ws3 = require('../../utils/ws3');

async function getVideosByUsername(username) {
  const user = await User.findOne({ username });
  return Video.find({ user: user.id }).sort({ createdAt: -1 });
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
  const [tidalPresets, totalSegments, cdnPresets] = await Promise.all([
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
    ws3
      .listObjectsV2({
        Bucket: 'cdn.bken.io',
        Prefix: `v/${id}`,
      })
      .promise()
      .then(({ Contents }) => {
        return Contents.map(({ Key }) => Key.split('/')[2].split('.')[0]);
      }),
  ]);
  
  const versions = await Promise.all(
    _.union(tidalPresets, cdnPresets).map(async (preset) => {
      const completedSegments = await ds3
        .listObjectsV2({ Bucket: 'tidal', Prefix: `${id}/versions/${preset}/segments/` })
        .promise()
        .then(({ Contents }) =>
          Contents.filter(({ Key }) => !Key.endsWith('/'))
        );
  
      return {
        preset,
        percentCompleted: cdnPresets.includes(preset) ? 100 :  (completedSegments.length / totalSegments) * 100,
        status: cdnPresets.includes(preset) ? 'completed' : 'processing',
        link: cdnPresets.includes(preset)
          ? `https://cdn.bken.io/v/${id}/${preset}.mp4`
          : '',
      };
    })
  );

  versions.sort((a, b) => (parseInt(a.preset.split('-')[1]) > parseInt(b.preset.split('-')[1])) ? -1 : 1);
  
  let status;
  
  if (!versions.filter(({ percentCompleted }) => percentCompleted).length) {
    status = 'segmenting';
  } else if (
    cdnPresets.filter((preset) => cdnPresets.includes(preset))
      .length === versions.length
  ) {
    status = 'completed';
  } else {
    status = 'processing';
  }
  
  return { status, versions };
}

module.exports = {
  deleteVideoById,
  getVideosByUsername,
  getTidalVersionsById,
  getTidalThumbnailsById,
};