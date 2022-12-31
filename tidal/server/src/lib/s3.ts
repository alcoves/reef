import path from 'path'
import AWS from 'aws-sdk'
import fs from 'fs-extra'
import mime from 'mime-types'
import { VideoUrls } from '../types'
import readdir from 'recursive-readdir'
import envVars from '../config/envVars'

AWS.config.update({
  maxRetries: 8,
  httpOptions: {
    timeout: 5000,
    connectTimeout: 3000,
  },
})

const opts: AWS.S3.ClientConfiguration = {
  signatureVersion: 'v4',
  // s3ForcePathStyle: false,
  region: envVars.awsDefaultRegion,
  accessKeyId: envVars.accessKeyId,
  secretAccessKey: envVars.secretAccessKey,
}

if (envVars.tidalEndpoint) {
  opts.endpoint = new AWS.Endpoint(envVars.tidalEndpoint)
}

const s3 = new AWS.S3(opts)

export function parseS3Uri(uri: string) {
  const s3UrlRe = /^[sS]3:\/\/(.*?)\/(.*)/
  const match = uri.match(s3UrlRe)
  if (!match) throw new Error(`Not a valid S3 URI: ${uri}`)

  return {
    Bucket: match[1],
    Key: match[2],
  }
}

export function generateS3Uri({ Bucket, Key }: { Bucket: string; Key: string }) {
  return `s3://${Bucket}/${Key}`
}

async function listObjects(params, items: any = []) {
  const { Contents, ContinuationToken } = await s3.listObjectsV2(params).promise()
  Contents?.map(o => items.push(o))
  if (ContinuationToken) {
    params.NextContinuationToken = ContinuationToken
    return listObjects(params, items)
  }
  return items
}

export async function uploadDir(inputDir, s3Path: string, bucketName: string) {
  try {
    const files = await readdir(inputDir)
    await Promise.all(
      files.map(f => {
        const uploadPath = path.normalize(`${s3Path}/${path.relative(inputDir, f)}`)
        console.log(`uploading ${f} to s3://${bucketName}/${uploadPath}`)
        s3.upload({
          Key: uploadPath,
          Bucket: bucketName,
          Body: fs.createReadStream(f),
          ContentType: mime.lookup(uploadPath),
        }).promise()
      })
    )
  } catch (error) {
    console.error(error)
    throw new Error(`failed to upload ${inputDir} to s3://${bucketName}/${s3Path}`)
  }
}

export async function downloadFile(outputPath, uri) {
  return new Promise((resolve, reject) => {
    try {
      if (uri.includes('s3://')) {
        const file = fs.createWriteStream(outputPath)
        s3.getObject({
          Key: parseS3Uri(uri).Key,
          Bucket: parseS3Uri(uri).Bucket,
        })
          .on('httpData', function (chunk) {
            file.write(chunk)
          })
          .on('httpDone', function () {
            console.log('file download complete')
            file.end()
            resolve('')
          })
          .send()
      } else {
        throw new Error('URL input type is not supported yet...')
      }
    } catch (error) {
      console.error('download file error', error)
      reject(error)
    }
  })
}

export async function deleteFolder(uri: string) {
  const allFiles = await listObjects({
    Prefix: parseS3Uri(uri).Key,
    Bucket: parseS3Uri(uri).Bucket,
  })

  await Promise.all(
    allFiles.map(f => {
      return s3
        .deleteObject({
          Key: f.Key,
          Bucket: parseS3Uri(uri).Bucket,
        })
        .promise()
    })
  )
}

export function getAssetPaths(id: string) {
  const base = `v/${id}`
  return {
    base,
    job: `${base}/job.json`,
  }
}

export function getAssetUrls(id: string): VideoUrls {
  let base = ''
  if (envVars.tidalCdnEndpoint) {
    base = `${envVars.tidalCdnEndpoint}/v/${id}`
  } else {
    base = `${envVars.tidalEndpoint}/${envVars.tidalBucket}/v/${id}`
  }

  return {
    dashUrl: `${base}/main.mpd`,
    m3u8Url: `${base}/main.m3u8`,
    thumbnailUrl: `${base}/thumbnail.jpeg`,
  }
}

export default s3
