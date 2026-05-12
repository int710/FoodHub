export enum TokenType {
  AccessToken,
  RefreshToken,
  ForgotPasswordToken,
  VerifyEmailToken
}

export enum Role {
  ADMIN,
  STAFF,
  CUSTOMER
}

export enum MediaType {
  Image,
  Video
}
export interface Media {
  type: MediaType
  url: string
}
