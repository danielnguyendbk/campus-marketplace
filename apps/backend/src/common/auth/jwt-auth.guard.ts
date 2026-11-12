import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  ACCESS_TOKEN_JWT,
  AccessTokenPayload,
} from '../../modules/auth/auth.types';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Tier-1 Authentication Guard (Unauthenticated vs Authenticated).
 * Verifies the Bearer access token and populates `req.user` with `AuthenticatedUser`.
 * Rejects missing, malformed, expired, or non-access tokens (e.g. `otp_ticket`) with HTTP 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_JWT) private readonly accessTokenJwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu đăng nhập để tiếp tục.',
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.accessTokenJwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (
      !payload ||
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'USER' && payload.role !== 'ADMIN') ||
      !['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(
        payload.verificationStatus,
      )
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
    }

    request.user = {
      id: payload.sub,
      schoolEmail: payload.email,
      role: payload.role,
      verificationStatus: payload.verificationStatus,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers?.authorization;
    if (!header || typeof header !== 'string') {
      return null;
    }
    const [scheme, value, ...rest] = header.trim().split(/\s+/);
    if (rest.length > 0 || !scheme || !value || scheme.toLowerCase() !== 'bearer') {
      return null;
    }
    return value;
  }
}

