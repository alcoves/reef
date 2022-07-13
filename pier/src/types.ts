enum JobState {
  failed = 'failed',
  active = 'active',
  waiting = 'waiting',
  delayed = 'delayed',
  unknown = 'unknown',
  completed = 'completed',
  waiting_children = 'waiting-children',
}
export interface TidalWebhookBody {
  data: any
  returnValue: any
  progress: number
  state: JobState
  id: string | undefined
  name: string | undefined
  queueName: string | undefined
}

export interface MetadataFormat {
  size: string
  bit_rate: string
  duration: string
  filename: string
  nb_streams: number
  start_time: string
  format_name: string
  nb_programs: number
  probe_score: number
  format_long_name: string
  tags: {
    encoder: string
    major_brand: string
    minor_version: string
    compatible_brands: string
  }
}

export interface MetadataStream {
  avg_frame_rate: string
  bit_rate: string
  bits_per_raw_sample: string
  chroma_location: string
  closed_captions: number
  codec_long_name: string
  codec_name: string
  codec_tag: string
  codec_tag_string: string
  codec_type: string
  coded_height: number
  coded_width: number
  display_aspect_ratio: string
  disposition: {
    attached_pic: number
    clean_effects: number
    comment: number
    default: number
    dub: number
    forced: number
    hearing_impaired: number
    karaoke: number
    lyrics: number
    original: number
    timed_thumbnails: number
    visual_impaired: number
  }
  duration: string
  duration_ts: number
  has_b_frames: number
  height: number
  index: number
  is_avc: string
  level: number
  nal_length_size: string
  nb_frames: string
  pix_fmt: string
  profile: string
  r_frame_rate: string
  refs: number
  sample_aspect_ratio: string
  start_pts: number
  start_time: string
  tags: {
    rotate: string
    creation_time: string
    handler_name: string
    language: string
    vendor_id: string
  }
  time_base: string
  width: number
}

export interface Metadata {
  format: MetadataFormat
  streams: MetadataStream[]
}
