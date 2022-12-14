import { s3 } from '../../config/s3'
import type { NextApiRequest, NextApiResponse } from 'next'

type UploadRequest = {
  url: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<UploadRequest>) {
  console.log('request')
  if (req.method === 'POST') {
    const url = await s3.getSignedUrlPromise('putObject', {
      Key: 'test.mp4',
      Bucket: process.env.DEFAULT_BUCKET,
    })

    return res.json({ url })
  } else {
    // Handle any other HTTP method
  }

  res.status(400)
}
