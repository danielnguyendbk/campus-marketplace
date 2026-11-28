import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/auth/jwt-auth.guard';
import { PostgresService } from '../../../database/postgres.service';
import { UserRole, VerificationStatus } from '../../auth/auth.types';

interface FeedUserLookupRow {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  reputation_score: string | number;
  province: string | null;
}

const ALLOWED_FEED_PAGINATION_KEYS = new Set(['page', 'limit']);

/**
 * Tier-3 Feed Access Guard (D05, D13, BR-04, DB05).
 * - Queries live `users` status (never trusts stale JWT `verificationStatus`).
 * - Blocks missing/deleted users (401), SUSPENDED users (403 ACCOUNT_SUSPENDED),
 *   and REJECTED non-admin users (403 ACCOUNT_NOT_VERIFIED).
 * - Allows PENDING users for basic feed viewing ONLY; rejects any search/filter
 *   query parameters from PENDING users with 403 ACCOUNT_NOT_VERIFIED (AC2).
 * - Allows APPROVED users and non-suspended ADMIN users.
 */
@Injectable()
export class FeedAccessGuard implements CanActivate {
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

    const result = await this.postgresService.query<FeedUserLookupRow>(
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

    const isAdmin = row.role === 'ADMIN';

    if (!isAdmin && row.verification_status === 'REJECTED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_VERIFIED',
        message:
          'Hồ sơ xác minh sinh viên đã bị từ chối. Vui lòng cập nhật lại minh chứng để xem bảng tin.',
      });
    }

    if (!isAdmin && row.verification_status === 'PENDING') {
      const queryKeys = Object.keys(request.query ?? {});
      const hasSearchOrFilterAttempt = queryKeys.some(
        (key) => !ALLOWED_FEED_PAGINATION_KEYS.has(key),
      );
      if (hasSearchOrFilterAttempt) {
        throw new ForbiddenException({
          code: 'ACCOUNT_NOT_VERIFIED',
          message:
            'Tài khoản chờ xác thực không được phép tìm kiếm hoặc lọc bài đăng.',
        });
      }
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
