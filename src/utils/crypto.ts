import bcrypt, { hash } from 'bcrypt'

const saltRounds = 10

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, saltRounds)
}

export const comparePassword = async (password: string, passwordHash: string) => {
  return await bcrypt.compare(password, passwordHash)
}
