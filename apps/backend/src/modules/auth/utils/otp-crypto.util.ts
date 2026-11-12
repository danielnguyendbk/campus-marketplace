import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/**
 * Generates a cryptographically random 6-digit numeric OTP code (000000 - 999999).
 */
export const generateOtpCode = (digits = 6): string => {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, '0');
};

/**
 * Computes an HMAC-SHA256 digest of the OTP bound to the normalized email.
 * Binding the email prevents reusing a precomputed hash across different recipients,
 * and HMAC with a server secret prevents offline brute-force of the 10^6 keyspace
 * if the `otp_verifications` table is ever leaked.
 */
export const hashOtpCode = (email: string, code: string, secret: string): string => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();
  return createHmac('sha256', secret)
    .update(`${normalizedEmail}:${normalizedCode}`)
    .digest('hex');
};

/**
 * Constant-time comparison between a candidate OTP code and a stored hex HMAC digest.
 */
export const verifyOtpCodeHash = (
  email: string,
  candidateCode: string,
  storedHexHash: string,
  secret: string,
): boolean => {
  const candidateHex = hashOtpCode(email, candidateCode, secret);
  if (candidateHex.length !== storedHexHash.length) {
    return false;
  }
  try {
    const a = Buffer.from(candidateHex, 'hex');
    const b = Buffer.from(storedHexHash, 'hex');
    if (a.length === 0 || a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

