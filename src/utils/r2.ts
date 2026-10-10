import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: (process.env.R2_S3_ENDPOINT || process.env.R2_URL_ENDPOINT) as string,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string
  }
})

export const uploadFileToR2 = async ({
  fileName,
  body,
  contentType
}: {
  fileName: string
  body: Buffer
  contentType: string
}) => {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_NAME_BUCKET,
    Key: fileName,
    Body: body,
    ContentType: contentType
  })
  await s3Client.send(command)
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
  if (publicBaseUrl) return `${publicBaseUrl}/${fileName}`

  const apiBaseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '')
  return `${apiBaseUrl}/api/v1/media/file/${encodeURIComponent(fileName.replace(/^image\//, ''))}`
}

export const getImageFromR2 = async (fileName: string) => {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_NAME_BUCKET,
      Key: `image/${fileName}`
    })
  )
  const bytes = await result.Body?.transformToByteArray()
  if (!bytes) throw new Error('Image not found')
  return {
    bytes: Buffer.from(bytes),
    contentType: result.ContentType || 'image/jpeg',
    etag: result.ETag
  }
}
