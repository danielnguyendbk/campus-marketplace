export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * An educational top-level entry such as `edu.vn` or `ac.uk` only describes the
 * country-level education namespace, never a real school (R05 / Decision D03), so it
 * requires at least one school label in front of it.
 */
const isEducationalTopLevelEntry = (allowed: string): boolean => {
  const labels = allowed.split('.');
  return labels.length === 2 && (labels[0] === 'edu' || labels[0] === 'ac');
};

/**
 * Checks whether `email` belongs to one of `allowedDomains`.
 * An entry such as `edu.vn` matches school domains (`user@ptit.edu.vn`) and any proper
 * subdomain (`user@stu.ptit.edu.vn`) but rejects the bare `user@edu.vn`; an explicit
 * school entry (`ptit.edu.vn`) matches that school and its subdomains. Look-alikes
 * (`user@fakeedu.vn`, `user@edu.vn.evil.com`) are always rejected.
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
    if (isEducationalTopLevelEntry(allowed)) {
      if (host.endsWith(`.${allowed}`)) {
        return true;
      }
      continue;
    }
    if (host === allowed || host.endsWith(`.${allowed}`)) {
      return true;
    }
  }

  return false;
};

