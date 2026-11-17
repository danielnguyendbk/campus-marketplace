import { isAllowedSchoolEmail, normalizeEmail } from './email.util';

describe('email.util', () => {
  it('normalizes email by trimming whitespace and lowercasing', () => {
    expect(normalizeEmail('  Student.A@STU.PTIT.EDU.VN \n')).toBe(
      'student.a@stu.ptit.edu.vn',
    );
  });

  describe('isAllowedSchoolEmail (default allowlist ["edu.vn"])', () => {
    const allowlist = ['edu.vn'];

    it.each(['sv@ptit.edu.vn', 'sv@stu.ptit.edu.vn', 'SV@HUST.EDU.VN'])(
      'accepts valid university email %s',
      (email) => {
        expect(isAllowedSchoolEmail(email, allowlist)).toBe(true);
      },
    );

    it.each([
      'user@gmail.com',
      'user@fakeedu.vn',
      'user@edu.vn.attacker.com',
      'user@.edu.vn',
      '@ptit.edu.vn',
      'no-at-symbol.edu.vn',
      'user@ptit..edu.vn',
      // R05: an educational top-level entry requires a school label in front of it
      'admin@edu.vn',
    ])('rejects disallowed or malformed email %s', (email) => {
      expect(isAllowedSchoolEmail(email, allowlist)).toBe(false);
    });
  });

  describe('R05 — educational top-level allowlist entries require a school label', () => {
    it('rejects the bare education namespace for edu.vn and ac.uk entries', () => {
      expect(isAllowedSchoolEmail('sv@edu.vn', ['edu.vn'])).toBe(false);
      expect(isAllowedSchoolEmail('sv@ac.uk', ['ac.uk'])).toBe(false);
    });

    it('still accepts school domains and their subdomains', () => {
      expect(isAllowedSchoolEmail('sv@ptit.edu.vn', ['edu.vn'])).toBe(true);
      expect(isAllowedSchoolEmail('sv@stu.ptit.edu.vn', ['edu.vn'])).toBe(true);
      expect(isAllowedSchoolEmail('sv@ox.ac.uk', ['ac.uk'])).toBe(true);
    });
  });

  it('supports explicit school domain allowlists', () => {
    const specificAllowlist = ['ptit.edu.vn', 'hust.edu.vn'];
    expect(isAllowedSchoolEmail('a@stu.ptit.edu.vn', specificAllowlist)).toBe(true);
    expect(isAllowedSchoolEmail('a@hust.edu.vn', specificAllowlist)).toBe(true);
    expect(isAllowedSchoolEmail('a@vnu.edu.vn', specificAllowlist)).toBe(false);
    // An explicit school entry still matches its own subdomains.
    expect(isAllowedSchoolEmail('a@ptit.edu.vn', specificAllowlist)).toBe(true);
  });
});

