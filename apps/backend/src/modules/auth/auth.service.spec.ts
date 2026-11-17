import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthConfig } from '../../config/env.config';
import { AuthService } from './auth.service';
import { AccessTokenPayload, AUTH_ERROR_CODES } from './auth.types';
import { OtpService } from './otp.service';
import { UserRepository, UserRow } from './repositories/user.repository';

describe('AuthService', () => {
  const config: AuthConfig = {
    jwtSecret: 'test-jwt-secret-at-least-32-characters-long!!',
    jwtExpiresInSeconds: 3600,
    otpHashSecret: 'test-otp-hash-secret-at-least-32-characters!!',
    otpTicketSecret: 'test-otp-ticket-secret-at-least-32-characters!!',
    otpTtlSeconds: 600,
    otpMaxAttempts: 5,
    otpResendCooldownSeconds: 60,
    otpMaxPerHour: 5,
    allowedSchoolDomains: ['edu.vn'],
    bcryptSaltRounds: 4, // fast for unit tests
  };

  let accessTokenJwt: JwtService;
  let otpService: jest.Mocked<
    Pick<OtpService, 'verifyOtpTicketClaims' | 'consumeOtpTicket'>
  >;
  let userRepository: jest.Mocked<
    Pick<
      UserRepository,
      'existsByEmail' | 'findActiveByEmail' | 'createUser'
    >
  >;
  let authService: AuthService;

  beforeEach(() => {
    accessTokenJwt = new JwtService({ secret: config.jwtSecret });
    otpService = {
      verifyOtpTicketClaims: jest.fn(),
      consumeOtpTicket: jest.fn().mockResolvedValue({
        email: 'sv01@ptit.edu.vn',
        otpId: '11111111-2222-3333-4444-555555555555',
      }),
    };
    userRepository = {
      existsByEmail: jest.fn().mockResolvedValue(false),
      findActiveByEmail: jest.fn(),
      createUser: jest.fn(),
    };

    authService = new AuthService(
      config,
      accessTokenJwt,
      otpService as unknown as OtpService,
      userRepository as unknown as UserRepository,
    );
  });

  describe('register', () => {
    it('does not hash password or create user when otpTicket is invalid', async () => {
      otpService.verifyOtpTicketClaims.mockRejectedValueOnce(
        new BadRequestException({
          code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
          message: 'Invalid ticket',
        }),
      );

      await expect(
        authService.register({
          otpTicket: 'bad-ticket',
          displayName: 'Sinh viên A',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it(' creates a PENDING USER with bcrypt-hashed password and returns AuthSession', async () => {
      otpService.verifyOtpTicketClaims.mockResolvedValue({
        email: 'sv01@ptit.edu.vn',
        otpId: '11111111-2222-3333-4444-555555555555',
      });
      userRepository.createUser.mockResolvedValue({
        id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
        displayName: 'Sinh viên A',
        role: 'USER',
        verificationStatus: 'PENDING',
      });

      const session = await authService.register({
        otpTicket: 'valid-ticket',
        displayName: '  Sinh viên A  ',
        password: 'StrongPassword123',
      });

      expect(otpService.consumeOtpTicket).toHaveBeenCalledWith('valid-ticket');
      expect(
        otpService.consumeOtpTicket.mock.invocationCallOrder[0],
      ).toBeLessThan(userRepository.createUser.mock.invocationCallOrder[0]);

      expect(userRepository.createUser).toHaveBeenCalledTimes(1);
      const createCall = userRepository.createUser.mock.calls[0][0];
      expect(createCall.schoolEmail).toBe('sv01@ptit.edu.vn');
      expect(createCall.displayName).toBe('Sinh viên A');
      expect(createCall.passwordHash).toMatch(/^\$2[ab]\$/);
      expect(createCall.passwordHash).not.toBe('StrongPassword123');
      await expect(
        bcrypt.compare('StrongPassword123', createCall.passwordHash),
      ).resolves.toBe(true);

      expect(session).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
          displayName: 'Sinh viên A',
          role: 'USER',
          verificationStatus: 'PENDING',
        },
      });

      const claims = await accessTokenJwt.verifyAsync<AccessTokenPayload>(
        session.accessToken,
      );
      expect(claims).toMatchObject({
        sub: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
        email: 'sv01@ptit.edu.vn',
        role: 'USER',
        verificationStatus: 'PENDING',
        typ: 'access',
      });
    });

    it('returns 409 EMAIL_ALREADY_REGISTERED when email exists or DB raises 23505', async () => {
      otpService.verifyOtpTicketClaims.mockResolvedValue({
        email: 'sv01@ptit.edu.vn',
        otpId: '11111111-2222-3333-4444-555555555555',
      });
      userRepository.existsByEmail.mockResolvedValueOnce(true);

      await expect(
        authService.register({
          otpTicket: 'valid-ticket',
          displayName: 'Sinh viên A',
          password: 'StrongPassword123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      // An existing account never consumes the ticket.
      expect(otpService.consumeOtpTicket).not.toHaveBeenCalled();

      // Race condition: existsByEmail returns false, then INSERT hits unique constraint 23505
      userRepository.existsByEmail.mockResolvedValueOnce(false);
      userRepository.createUser.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key value'), { code: '23505' }),
      );

      await expect(
        authService.register({
          otpTicket: 'valid-ticket',
          displayName: 'Sinh viên A',
          password: 'StrongPassword123',
        }),
      ).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED },
      });
    });

    it('rejects a lost consume race with 400 OTP_TICKET_INVALID and creates nothing', async () => {
      otpService.verifyOtpTicketClaims.mockResolvedValue({
        email: 'sv02@ptit.edu.vn',
        otpId: '11111111-2222-3333-4444-555555555555',
      });
      otpService.consumeOtpTicket.mockRejectedValueOnce(
        new BadRequestException({
          code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
          message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
        }),
      );

      await expect(
        authService.register({
          otpTicket: 'valid-ticket',
          displayName: 'Sinh viên B',
          password: 'StrongPassword123',
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: AUTH_ERROR_CODES.OTP_TICKET_INVALID },
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('returns 409 when the consume race was lost but the account exists meanwhile', async () => {
      otpService.verifyOtpTicketClaims.mockResolvedValue({
        email: 'sv03@ptit.edu.vn',
        otpId: '11111111-2222-3333-4444-555555555555',
      });
      otpService.consumeOtpTicket.mockRejectedValueOnce(
        new BadRequestException({
          code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
          message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
        }),
      );
      userRepository.existsByEmail
        .mockResolvedValueOnce(false) // before consume
        .mockResolvedValueOnce(true); // after the concurrent winner committed

      await expect(
        authService.register({
          otpTicket: 'valid-ticket',
          displayName: 'Sinh viên C',
          password: 'StrongPassword123',
        }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED },
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const makeUserRow = async (
      overrides: Partial<UserRow> = {},
    ): Promise<UserRow> => ({
      id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
      school_email: 'sv01@ptit.edu.vn',
      password_hash: await bcrypt.hash('CorrectPassword123', 4),
      display_name: 'Sinh viên A',
      role: 'USER',
      verification_status: 'PENDING',
      ...overrides,
    });

    it('logs in PENDING, APPROVED, and REJECTED accounts with correct role and status', async () => {
      for (const status of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
        userRepository.findActiveByEmail.mockResolvedValueOnce(
          await makeUserRow({ verification_status: status }),
        );
        const session = await authService.login(
          '  SV01@PTIT.EDU.VN ',
          'CorrectPassword123',
        );
        expect(session.user.verificationStatus).toBe(status);
        expect(session.user.role).toBe('USER');
      }
    });

    it('rejects unknown email and wrong password with the exact same 401 INVALID_CREDENTIALS error', async () => {
      userRepository.findActiveByEmail.mockResolvedValueOnce(null);
      await expect(
        authService.login('unknown@ptit.edu.vn', 'CorrectPassword123'),
      ).rejects.toEqual(
        new UnauthorizedException({
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Email hoặc mật khẩu không chính xác.',
        }),
      );

      userRepository.findActiveByEmail.mockResolvedValueOnce(await makeUserRow());
      await expect(
        authService.login('sv01@ptit.edu.vn', 'WrongPassword999'),
      ).rejects.toEqual(
        new UnauthorizedException({
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Email hoặc mật khẩu không chính xác.',
        }),
      );
    });

    it('blocks SUSPENDED accounts with 403 ACCOUNT_SUSPENDED', async () => {
      userRepository.findActiveByEmail.mockResolvedValueOnce(
        await makeUserRow({ verification_status: 'SUSPENDED' }),
      );

      await expect(
        authService.login('sv01@ptit.edu.vn', 'CorrectPassword123'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

