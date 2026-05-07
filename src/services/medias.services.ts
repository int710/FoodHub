import { Request } from 'express'
import sharp from 'sharp'
import fs, { promises } from 'fs'
import { Media, MediaType } from '~/constants/enums'
import { handleUploadImage } from '~/utils/file'
import { uploadFileToR2 } from '~/utils/r2'
import mime from 'mime'

class MediaServices {
  async handleUploadImage(req: Request) {
    const files = await handleUploadImage(req)
    const result: Media[] = await Promise.all(
      files.map(async (file) => {
        const fileContent = await sharp(file.filepath).toBuffer()

        const url = await uploadFileToR2({
          fileName: `image/${file.newFilename}`,
          body: fileContent,
          contentType: mime.getType(file.newFilename) || 'image/jpeg'
        })

        await promises.unlink(file.filepath)

        return {
          type: MediaType.Image,
          url
        }
      })
    )
    return result
  }
}

const mediaServices = new MediaServices()
export default mediaServices
