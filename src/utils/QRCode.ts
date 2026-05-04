import QRCode from 'qrcode'

export const generateQR = async (qrContent: string) => {
  try {
    return await QRCode.toDataURL(qrContent, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1c78f9',
        light: '#F8FAFC'
      }
    })
  } catch (error) {
    console.error('Lỗi tạo QR:', error)
    return null
  }
}
