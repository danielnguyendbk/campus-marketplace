import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { UserRole, VerificationStatus } from '../../modules/auth/auth.types';
import { AuthenticatedRequest } from './jwt-auth.guard';

interface UserVerificationRow {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  reputation_score: string | number;
  province: string | null;
}

/**
 * Tier-3 Verification Guard (BR-01, BR-04, DB05).
 * Enforces that the authenticated user is currently `APPROVED` (or `ADMIN`)
 * by querying the live `users` table rather than trusting stale JWT claims.
 */
@Injectable()
export class VerificationGuard implements CanActivate {
  constructor(private readonly postgresService: PostgresService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser = request.user;

    if (!authUser?.id) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập để tiếp tục.',
      });
    }

    const result = await this.postgresService.query<UserVerificationRow>(
      `SELECT "id", "school_email", "display_name", "role", "verification_status", "reputation_score", "province"
       FROM "users"
       WHERE "id" = $1 AND "deleted_at" IS NULL
       LIMIT 1;`,
      [authUser.id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
      });
    }

    if (row.verification_status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa.',
      });
    }

    if (row.verification_status !== 'APPROVED' && row.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_VERIFIED',
        message:
          'Chỉ tài khoản sinh viên đã xác thực (APPROVED) mới được phép thực hiện thao tác này.',
      });
    }

    request.user = {
      id: row.id,
      schoolEmail: row.school_email,
      role: row.role,
      verificationStatus: row.verification_status,
      displayName: row.display_name,
      reputationScore: Number(row.reputation_score),
      province: row.province,
    };

    return true;
  }
}
