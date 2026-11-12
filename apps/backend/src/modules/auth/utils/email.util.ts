export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Checks whether `email` belongs to one of `allowedDomains`.
 * An entry such as `edu.vn` or `ptit.edu.vn` matches both the exact domain
 * (`user@ptit.edu.vn`) and any proper subdomain (`user@stu.ptit.edu.vn`),
 * while rejecting look-alikes (`user@fakeedu.vn`, `user@edu.vn.evil.com`).
 */
export const isAllowedSchoolEmail = (email: string, allowedDomains: string[]): boolean => {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return false;
  }

  const localPart = normalized.slice(0, atIndex);
  const host = normalized.slice(atIndex + 1);

  if (!localPart || host.startsWith('.') || host.endsWith('.') || host.includes('..')) {
    return false;
  }

  // Basic hostname sanity check: ASCII labels separated by dots
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
    return false;
  }

  for (const rawAllowed of allowedDomains) {
    const allowed = rawAllowed.trim().toLowerCase().replace(/^\*?\.?/, '');
    if (!allowed) continue;
    if (host === allowed || host.endsWith(`.${allowed}`)) {
      return true;
    }
  }

  return false;
};

