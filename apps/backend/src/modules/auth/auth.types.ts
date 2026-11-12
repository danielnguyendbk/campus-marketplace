export type UserRole = 'USER' | 'ADMIN';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** OpenAPI v1.2 #/components/schemas/AuthUser */
export interface AuthUser {
  id: string;
  displayName: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
}

/** OpenAPI v1.2 #/components/schemas/AuthSession */
export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

/** OpenAPI v1.2 #/components/schemas/VerifyOtpResult */
export interface VerifyOtpResult {
  otpTicket: string;
  expiresIn: number;
}

/** OpenAPI v1.2 #/components/schemas/SimpleMessage */
export interface SimpleMessage {
  success: boolean;
  message: string;
}

/** Access token JWT claims. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  typ: 'access';
}

/** One-time registration ticket JWT claims (signed with a separate secret). */
export interface OtpTicketPayload {
  sub: string; // normalized school email
  otpId: string;
  typ: 'otp_ticket';
}

export const AUTH_ERROR_CODES = {
  EMAIL_DOMAIN_NOT_ALLOWED: 'EMAIL_DOMAIN_NOT_ALLOWED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_TICKET_INVALID: 'OTP_TICKET_INVALID',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
} as const;

export const OTP_REQUEST_GENERIC_MESSAGE = 'Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi.';

/** DI tokens */
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const MAIL_CONFIG = Symbol('MAIL_CONFIG');
export const ACCESS_TOKEN_JWT = Symbol('ACCESS_TOKEN_JWT');
export const OTP_TICKET_JWT = Symbol('OTP_TICKET_JWT');

