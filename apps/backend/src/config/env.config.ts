export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
}

export const getAppConfig = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
});

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  otpHashSecret: string;
  otpTicketSecret: string;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpMaxPerHour: number;
  allowedSchoolDomains: string[];
  bcryptSaltRounds: number;
}

export type MailTransport = 'console' | 'smtp';

export interface MailConfig {
  transport: MailTransport;
  from: string;
  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

const isProduction = (): boolean => (process.env.NODE_ENV || 'development') === 'production';

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const value = parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Reads a secret from the environment. In production a missing/short secret is a fatal
 * configuration error. Outside production a clearly-marked development fallback is used
 * so local dev, unit tests and CI E2E (mocked database) can run without real secrets.
 */
const readSecret = (name: string): string => {
  const value = process.env[name]?.trim();
  if (value && value.length >= 32) {
    return value;
  }
  if (isProduction()) {
    throw new Error(`${name} must be set to a random value of at least 32 characters in production.`);
  }
  return `dev-only-insecure-${name.toLowerCase()}-change-me-000000`;
};

export const parseAllowedDomains = (raw: string | undefined): string[] => {
  const domains = (raw ?? 'edu.vn')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^\*?\.?/, ''))
    .filter((d) => d.length > 0);
  return domains.length > 0 ? domains : ['edu.vn'];
};

export const getAuthConfig = (): AuthConfig => ({
  jwtSecret: readSecret('JWT_SECRET'),
  jwtExpiresInSeconds: parsePositiveInt(process.env.JWT_EXPIRES_IN, 3600),
  otpHashSecret: readSecret('OTP_HASH_SECRET'),
  otpTicketSecret: readSecret('OTP_TICKET_SECRET'),
  otpTtlSeconds: parsePositiveInt(process.env.OTP_TTL_SECONDS, 600),
  otpMaxAttempts: parsePositiveInt(process.env.OTP_MAX_ATTEMPTS, 5),
  otpResendCooldownSeconds: parsePositiveInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  otpMaxPerHour: parsePositiveInt(process.env.OTP_MAX_PER_HOUR, 5),
  allowedSchoolDomains: parseAllowedDomains(process.env.ALLOWED_SCHOOL_DOMAINS),
  bcryptSaltRounds: parsePositiveInt(process.env.BCRYPT_SALT_ROUNDS, 12),
});

export const getMailConfig = (): MailConfig => {
  const requested = (process.env.MAIL_TRANSPORT || '').trim().toLowerCase();
  let transport: MailTransport = requested === 'smtp' ? 'smtp' : 'console';
  if (isProduction()) {
    // Never print OTP codes to logs in production.
    transport = 'smtp';
  }
  return {
    transport,
    from: process.env.MAIL_FROM || 'Campus Marketplace <no-reply@campus-marketplace.local>',
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parsePositiveInt(process.env.SMTP_PORT, 587),
    smtpSecure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  };
};
