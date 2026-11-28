export type AuthMode = 'live' | 'mock';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export interface RequestOtpBody {
  email: string;
}
export interface VerifyOtpBody {
  email: string;
  code: string;
}
export interface VerifyOtpResult {
  otpTicket: string;
  expiresIn: number;
}
export interface RegisterBody {
  otpTicket: string;
  displayName: string;
  password: string;
}
export interface LoginBody {
  email: string;
  password: string;
}
export interface SimpleMessage {
  success: boolean;
  message: string;
}
export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    displayName: string;
    role: 'USER' | 'ADMIN';
    verificationStatus: VerificationStatus;
  };
}

type MarketplaceUser = Pick<AuthSession['user'], 'role' | 'verificationStatus'>;

export function canReadMarketplacePosts(user?: MarketplaceUser): boolean {
  return Boolean(
    user &&
    (user.verificationStatus === 'APPROVED' ||
      (user.role === 'ADMIN' && user.verificationStatus !== 'SUSPENDED')),
  );
}

export function canPublishMarketplacePosts(user?: MarketplaceUser): boolean {
  return user?.role === 'USER' && user.verificationStatus === 'APPROVED';
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  if (!session.user || typeof session.user !== 'object') return false;
  const user = session.user as Record<string, unknown>;
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    session.tokenType === 'Bearer' &&
    typeof session.expiresIn === 'number' &&
    Number.isInteger(session.expiresIn) &&
    session.expiresIn > 0 &&
    typeof user.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) &&
    typeof user.displayName === 'string' &&
    (user.role === 'USER' || user.role === 'ADMIN') &&
    typeof user.verificationStatus === 'string' &&
    ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(user.verificationStatus)
  );
}

export function emailValidation(email: string, schoolOnly = false): string | undefined {
  if (!email.trim()) return 'Vui lòng nhập email trường của bạn.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email chưa đúng định dạng.';
  if (schoolOnly && !/^[^\s@]+@(?:[a-z0-9-]+\.)+edu\.vn$/i.test(email.trim())) {
    return 'Vui lòng sử dụng email trường có tên miền .edu.vn.';
  }
  return undefined;
}
