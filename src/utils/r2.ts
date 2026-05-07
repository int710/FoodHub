import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_URL_ENDPOINT as string,
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
  return `${process.env.R2_URL_ENDPOINT}/${fileName}`
}
