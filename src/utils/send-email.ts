import { Resend } from 'resend'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import Handlebars from 'handlebars'
config()

type sendMailType = {
  to: string
  subject: string
  html: string
}

const source = fs.readFileSync(path.join(__dirname, 'template-email.html'), 'utf8')
const template = Handlebars.compile(source)

const resend = new Resend(process.env.ResendAPIKey)
const sendEmail = async ({ to, subject, html }: sendMailType) => {
  const { data, error } = await resend.emails.send({
    from: process.env.From_Send_Email as string,
    to,
    subject,
    html
  })

  if (error) {
    throw error
  }
  return data
}

export const sendVerifyEmail = ({ to, name, verifyToken }: { to: string; name: string; verifyToken: string }) => {
  const html = template({
    title: 'Xác thực tài khoản FoodHub',
    content: `Chào ${name}, chúc mừng bạn đã đăng ký tài khoản thành công, vui lòng bấm vào link để tiến hành xác thực tài khoản !`,
    button_text: 'Xác thực ngay',
    button_url: `https://localhost:3000/verify?token=${verifyToken}`
  })
  const subject = 'Verify email account'
  return sendEmail({ to, subject, html })
}

export const sendEmailForgotPassword = ({
  to,
  name,
  forgotPasswordToken
}: {
  to: string
  name: string
  forgotPasswordToken: string
}) => {
  const html = template({
    title: 'Khôi phục mật khẩu tài khoản FoodHub',
    content: `Xin chào ${name}, bạn vừa yêu cầu khôi phục mật khẩu tài khoản, vui lòng bấm vào link dưới đây để hoàn tất quá trình, liên kết chỉ hợp lệ trong vòng 12h tính từ thời điểm bạn nhận được email này !`,
    button_text: 'Khôi phục ngay',
    button_url: `https://localhost:3000/forgot-password?token=${forgotPasswordToken}`
  })
  const subject = 'Quên mật khẩu'
  return sendEmail({ to, subject, html })
}
