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

export const TABLE_SESSION_TTL = 8 * 60 * 60 // 8h (28800 second)
