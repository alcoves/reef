import db from '../config/db'
import mime from 'mime-types'
import s3, { defaultBucket } from '../config/s3'
import { optimizeUserAvatar, parseDataURIScheme, getAvatarUploadKey } from '../service/images'

export async function patchUser(req, res) {
  let userIdToModify = req.params.userId
  if (userIdToModify === '@me') userIdToModify = req.user.id
  if (userIdToModify !== req.user.id) return res.sendStatus(403)

  const userUpdate: any = {}
  if (req.body.image) {
    const parsedDataURIScheme = parseDataURIScheme(req.body.image)
    if (parsedDataURIScheme) {
      const imageBuffer = await optimizeUserAvatar(parsedDataURIScheme)
      const res = await s3
        .upload({
          Body: imageBuffer,
          Bucket: defaultBucket,
          ContentType: mime.contentType(parsedDataURIScheme.contentType),
          Key: getAvatarUploadKey(req.user.id, parsedDataURIScheme.contentType),
        })
        .promise()
      userUpdate.image = `https://cdn.bken.io/${res.Key}`
    }
  }

  const user = await db.user.update({
    where: { id: userIdToModify },
    data: userUpdate,
  })

  return res.json({
    status: 'success',
    payload: { user },
  })
}
