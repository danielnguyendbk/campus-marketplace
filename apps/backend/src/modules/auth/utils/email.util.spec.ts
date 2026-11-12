import { isAllowedSchoolEmail, normalizeEmail } from './email.util';

describe('email.util', () => {
  it('normalizes email by trimming whitespace and lowercasing', () => {
    expect(normalizeEmail('  Student.A@STU.PTIT.EDU.VN \n')).toBe(
      'student.a@stu.ptit.edu.vn',
    );
  });

  describe('isAllowedSchoolEmail (default allowlist ["edu.vn"])', () => {
    const allowlist = ['edu.vn'];

    it.each([
      'sv@ptit.edu.vn',
      'sv@stu.ptit.edu.vn',
      'SV@HUST.EDU.VN',
      'admin@edu.vn',
    ])('accepts valid university email %s', (email) => {
      expect(isAllowedSchoolEmail(email, allowlist)).toBe(true);
    });

    it.each([
      'user@gmail.com',
      'user@fakeedu.vn',
      'user@edu.vn.attacker.com',
      'user@.edu.vn',
      '@ptit.edu.vn',
      'no-at-symbol.edu.vn',
      'user@ptit..edu.vn',
    ])('rejects disallowed or malformed email %s', (email) => {
      expect(isAllowedSchoolEmail(email, allowlist)).toBe(false);
    });
  });

  it('supports explicit school domain allowlists', () => {
    const specificAllowlist = ['ptit.edu.vn', 'hust.edu.vn'];
    expect(isAllowedSchoolEmail('a@stu.ptit.edu.vn', specificAllowlist)).toBe(true);
    expect(isAllowedSchoolEmail('a@hust.edu.vn', specificAllowlist)).toBe(true);
    expect(isAllowedSchoolEmail('a@vnu.edu.vn', specificAllowlist)).toBe(false);
  });
});

