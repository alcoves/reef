import url from 'url'
import Joi from 'joi'
import path from 'path'
import { db } from '../config/db'
import { v4 as uuidv4 } from 'uuid'
import queues from '../queues/queues'
import {
  IngestionJobData,
  MetadataJobData,
  ThumbnailJobData,
  AdaptiveTranscodeJobData,
} from '../types'

export async function deleteVideo(req, res) {
  await db.video.update({
    data: { deleted: true },
    where: { id: req.params.videoId },
  })
  res.sendStatus(200)
}

export async function getVideo(req, res) {
  const videos = await db.video.findMany({
    orderBy: { createdAt: 'desc' },
    where: { id: req.params.videoId, deleted: false },
    include: {
      source: true,
    },
  })
  if (videos.length) return res.json(videos[0])
  return res.sendStatus(404)
}

export async function listVideos(req, res) {
  const videos = await db.video.findMany({
    where: { deleted: false },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ videos })
}

export async function createVideo(req, res) {
  const schema = Joi.object({
    input: Joi.string().uri().required(),
  })

  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  })
  if (error) return res.status(400).json(error)

  const video = await db.video.create({ data: {} })

  const cleanedUrl = url.parse(value.input).pathname || ''
  const sourceFileExtension = path.extname(cleanedUrl) || ''

  const source = await db.source.create({
    data: {
      url: value.input,
      videoId: video.id,
      s3Key: `assets/videos/${video.id}/source${sourceFileExtension}`,
    },
  })

  const ingestionJob: IngestionJobData = {
    input: value.input,
    output: source.s3Key,
    assetId: source.id,
  }

  const job = await queues.ingestion.queue.add('ingestion', ingestionJob)
  // return res.status(202).json({ id: job.id })
  res.json(video)
}

export async function createMetadata(req, res) {
  const schema = Joi.object({
    assetId: Joi.string().required(),
    input: Joi.string().uri().required(),
  })

  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  })
  if (error) return res.status(400).json(error)

  const metadataJob: MetadataJobData = {
    input: value.input,
    assetId: value.assetId,
  }

  const job = await queues.metadata.queue.add('metadata', metadataJob)
  return res.status(202).json({ id: job.id })
}

export async function createThumbnail(req, res) {
  const schema = Joi.object({
    assetId: Joi.string().required(),
    input: Joi.string().uri().required(),
    output: Joi.string().uri().required(),
    time: Joi.string().default('00:00:00:000'),
    width: Joi.number().min(1).max(10000).required(),
    height: Joi.number().min(1).max(10000).required(),
    fit: Joi.string().uri().default('cover').valid('cover', 'contain', 'fill', 'inside', 'outside'),
  })

  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  })
  if (error) return res.status(400).json(error)

  const thumbnailJob: ThumbnailJobData = {
    fit: value.fit,
    time: value.time,
    input: value.input,
    width: value.width,
    height: value.height,
    assetId: value.assetId,
    output: value.output.replace('$id', uuidv4()),
  }

  await queues.thumbnail.queue.add('thumbnail', thumbnailJob)
  return res.status(202).end()
}

export async function adaptiveTranscodeHandler(req, res) {
  const schema = Joi.object({
    assetId: Joi.string().required(),
    input: Joi.string().uri().required(),
    output: Joi.string().uri().required(),
  })

  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  })
  if (error) return res.status(400).json(error)

  const adaptiveTranscodeJobData: AdaptiveTranscodeJobData = {
    input: value.input,
    output: value.output,
    assetId: value.assetId,
  }

  await queues.adaptiveTranscode.queue.add('transcode', adaptiveTranscodeJobData)
  return res.status(202).end()

  return res.status(400).end()
}
