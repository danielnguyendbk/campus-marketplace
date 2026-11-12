import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCodeHash,
} from './otp-crypto.util';

describe('otp-crypto.util', () => {
  const secret = 'unit-test-otp-hmac-secret-at-least-32-chars!!';

  it('generates a 6-digit numeric OTP code', () => {
    for (let i = 0; i < 25; i++) {
      const code = generateOtpCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('produces a 64-char hex HMAC-SHA256 digest that never contains the plaintext code', () => {
    const code = '123456';
    const digest = hashOtpCode('sv@ptit.edu.vn', code, secret);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(code);
  });

  it('binds the hash to both email and secret', () => {
    const h1 = hashOtpCode('sv1@ptit.edu.vn', '654321', secret);
    const h2 = hashOtpCode('sv2@ptit.edu.vn', '654321', secret);
    const h3 = hashOtpCode('sv1@ptit.edu.vn', '654321', 'different-secret-0000000000000000');

    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('verifies matching OTP codes and rejects wrong codes or malformed hashes', () => {
    const email = 'sv@ptit.edu.vn';
    const hash = hashOtpCode(email, '112233', secret);

    expect(verifyOtpCodeHash(email, '112233', hash, secret)).toBe(true);
    expect(verifyOtpCodeHash('  SV@PTIT.EDU.VN ', '112233', hash, secret)).toBe(true);
    expect(verifyOtpCodeHash(email, '112234', hash, secret)).toBe(false);
    expect(verifyOtpCodeHash('other@ptit.edu.vn', '112233', hash, secret)).toBe(false);
    expect(verifyOtpCodeHash(email, '112233', 'invalid-hex', secret)).toBe(false);
  });
});

