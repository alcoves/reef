import { FfprobeFormat, FfprobeStream } from 'fluent-ffmpeg'

export interface Progress {
  frames: number
  percent: number
  timemark: string
  currentFps: number
  targetSize: number
  currentKbps: number
}

export interface Metadata {
  audio: FfprobeStream
  video: FfprobeStream
  format: FfprobeFormat
}

export interface S3KeyParameters {
  key: string
  bucket: string
}

export interface S3PathParameters {
  path: string
  bucket: string
}

export interface Preset {
  id: string
  name: string
  cmd: string
  constraints: Constraints
}

interface Constraints {
  width: number
  height: number
}

export interface TranscodeJobData {
  cmd: string
  input: string
  output: string
  parentId: string
  webhooks: boolean
  constraints: Constraints
}

export interface TranscodeProgressiveJobData {
  cmd: string
  input: string
  output: string
  webhooks: boolean
}

export interface ThumbnailJobData {
  input: S3KeyParameters
  output: S3KeyParameters
}

export interface MetadataJobData {
  input: S3KeyParameters
}

export interface TidalWebhookBody {
  data: any
  returnValue: any
  isFailed: boolean
  id: string | undefined
  name: string | undefined
  progress: number | object
  queueName: string | undefined
}

export interface PackageJobData {
  tmpDir: string
  entityId: string
  input: S3KeyParameters
  output: S3PathParameters
}

export interface TidalSettings {
  apiKey: string
  webhookUrl: string
  cdnHostname: string
  bunnyAccessKey: string
  s3Endpoint: string
  s3AccessKeyId: string
  nfsMountPath: string
  s3SecretAccessKey: string
}
