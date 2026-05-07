import { Request } from 'express'
import formidable, { File } from 'formidable'
import fs from 'fs'
import { UPLOAD_IMAGE_DIR } from '~/constants/dir'

export const initFolderUpload = () => {
  if (!fs.existsSync(UPLOAD_IMAGE_DIR)) {
    fs.mkdirSync(UPLOAD_IMAGE_DIR, { recursive: true })
  }
}

export const handleUploadImage = (req: Request) => {
  const form = formidable({
    uploadDir: UPLOAD_IMAGE_DIR,
    maxFiles: 3,
    maxFileSize: 2 * 1024 * 1024, // 2MB
    maxTotalFileSize: 2 * 1024 * 1024 * 3, //6 MB total
    keepExtensions: true,
    filter: function ({ mimetype }) {
      const valid = Boolean(mimetype && mimetype.includes('image'))
      if (!valid) {
        form.emit('error', new Error('Invalid file type, only image is allowed'))
      }
      return valid
    }
  })

  return new Promise<File[]>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err)
      }
      if (!files.image) {
        return reject(new Error('File is empty !'))
      }

      // Xử lý cả trường hợp ảnh được tải lên dưới dạng 1 File hay File[]
      resolve(files.image as File[])
    })
  })
}
