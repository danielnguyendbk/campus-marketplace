import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthConfig } from '../../config/env.config';
import {
  ACCESS_TOKEN_JWT,
  AccessTokenPayload,
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AuthSession,
  AuthUser,
} from './auth.types';
import { RegisterDto } from './dto/register.dto';
import { OtpService } from './otp.service';
import { UserRepository } from './repositories/user.repository';
import { normalizeEmail } from './utils/email.util';

/**
 * Precomputed bcrypt hash (cost 10) used when an account does not exist so that
 * login timing does not trivially reveal email existence.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8p4r1eH3A9nE7B2r0s9u1Q0mK2yY8W';

const isUniqueViolation = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  return (err as { code?: string }).code === '23505';
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(ACCESS_TOKEN_JWT) private readonly accessTokenJwt: JwtService,
    private readonly otpService: OtpService,
    private readonly userRepository: UserRepository,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const { email } = await this.otpService.verifyOtpTicket(dto.otpTicket);

    const alreadyExists = await this.userRepository.existsByEmail(email);
    if (alreadyExists) {
      throw new ConflictException({
        code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        message: 'Email trường này đã được đăng ký tài khoản.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, this.config.bcryptSaltRounds);

    let user: AuthUser;
    try {
      user = await this.userRepository.createWithPreferences({
        schoolEmail: email,
        passwordHash,
        displayName: dto.displayName.trim(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
          message: 'Email trường này đã được đăng ký tài khoản.',
        });
      }
      throw error;
    }

    return this.issueSession(user, email);
  }

  async login(rawEmail: string, password: string): Promise<AuthSession> {
    const email = normalizeEmail(rawEmail);
    const userRow = await this.userRepository.findActiveByEmail(email);

    if (!userRow) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const passwordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (userRow.verification_status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Tài khoản của bạn đã bị tạm khóa.',
      });
    }

    const user: AuthUser = {
      id: userRow.id,
      displayName: userRow.display_name,
      role: userRow.role,
      verificationStatus: userRow.verification_status,
    };

    return this.issueSession(user, userRow.school_email);
  }

  private async issueSession(user: AuthUser, email: string): Promise<AuthSession> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email,
      role: user.role,
      verificationStatus: user.verificationStatus,
      typ: 'access',
    };

    const accessToken = await this.accessTokenJwt.signAsync(payload, {
      expiresIn: this.config.jwtExpiresInSeconds,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresInSeconds,
      user,
    };
  }
}

