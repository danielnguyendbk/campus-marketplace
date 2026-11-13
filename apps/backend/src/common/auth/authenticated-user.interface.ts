import { UserRole, VerificationStatus } from '../../modules/auth/auth.types';

/**
 * Shared Kernel user context attached to `req.user` by `JwtAuthGuard`
 * (see tasks/BACKLOG.md §1 Shared Kernel).
 */
export interface AuthenticatedUser {
  id: string;
  schoolEmail: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
}

