import { BadRequestException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '../../config/env.config';
import {
  AUTH_ERROR_CODES,
  OTP_REQUEST_GENERIC_MESSAGE,
  OtpTicketPayload,
} from './auth.types';
import { MailService } from './mail/mail.service';
import { OtpService } from './otp.service';
import { OtpRepository, OtpVerificationRow } from './repositories/otp.repository';
import { UserRepository } from './repositories/user.repository';
import { hashOtpCode } from './utils/otp-crypto.util';

describe('OtpService', () => {
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
    bcryptSaltRounds: 4,
  };

  let otpTicketJwt: JwtService;
  let otpRepository: jest.Mocked<
    Pick<
      OtpRepository,
      | 'getSendStats'
      | 'expireActiveByEmail'
      | 'createOtp'
      | 'expireById'
      | 'findLatestActiveByEmail'
      | 'incrementAttempts'
      | 'markVerified'
      | 'findById'
    >
  >;
  let userRepository: jest.Mocked<Pick<UserRepository, 'existsByEmail'>>;
  let mailService: jest.Mocked<MailService>;
  let service: OtpService;

  beforeEach(() => {
    otpTicketJwt = new JwtService({ secret: config.otpTicketSecret });
    otpRepository = {
      getSendStats: jest.fn().mockResolvedValue({ lastHourCount: 0, lastSentAt: null }),
      expireActiveByEmail: jest.fn().mockResolvedValue(undefined),
      createOtp: jest.fn().mockImplementation(async ({ email, codeHash, expiresAt }) => ({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        email,
        code_hash: codeHash,
        purpose: 'REGISTER',
        expires_at: expiresAt,
        attempts: 0,
        verified_at: null,
        created_at: new Date(),
      })),
      expireById: jest.fn().mockResolvedValue(undefined),
      findLatestActiveByEmail: jest.fn(),
      incrementAttempts: jest.fn(),
      markVerified: jest.fn().mockResolvedValue(true),
      findById: jest.fn(),
    };
    userRepository = {
      existsByEmail: jest.fn().mockResolvedValue(false),
    };
    mailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new OtpService(
      config,
      otpTicketJwt,
      otpRepository as unknown as OtpRepository,
      userRepository as unknown as UserRepository,
      mailService,
    );
  });

  describe('requestOtp', () => {
    it('rejects non-allowlisted email domain with 400 EMAIL_DOMAIN_NOT_ALLOWED', async () => {
      await expect(service.requestOtp('user@gmail.com')).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED },
      });
      expect(otpRepository.createOtp).not.toHaveBeenCalled();
      expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('returns generic 200 without generating or sending OTP when email is already registered (D3)', async () => {
      userRepository.existsByEmail.mockResolvedValue(true);

      const res = await service.requestOtp('  SV01@PTIT.EDU.VN ');
      expect(res).toEqual({
        success: true,
        message: OTP_REQUEST_GENERIC_MESSAGE,
      });
      expect(userRepository.existsByEmail).toHaveBeenCalledWith('sv01@ptit.edu.vn');
      expect(otpRepository.createOtp).not.toHaveBeenCalled();
      expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('enforces resend cooldown and hourly quota with 429 OTP_RATE_LIMITED', async () => {
      otpRepository.getSendStats.mockResolvedValueOnce({
        lastHourCount: 1,
        lastSentAt: new Date(Date.now() - 15_000), // 15s ago (< 60s cooldown)
      });

      await expect(service.requestOtp('sv@ptit.edu.vn')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { code: AUTH_ERROR_CODES.OTP_RATE_LIMITED },
      });

      otpRepository.getSendStats.mockResolvedValueOnce({
        lastHourCount: 5, // reached max per hour
        lastSentAt: new Date(Date.now() - 120_000),
      });

      await expect(service.requestOtp('sv@ptit.edu.vn')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { code: AUTH_ERROR_CODES.OTP_RATE_LIMITED },
      });
    });

    it('stores HMAC hash (never plaintext) and dispatches 6-digit OTP via MailService', async () => {
      const res = await service.requestOtp('SV@stu.ptit.edu.vn');
      expect(res).toEqual({
        success: true,
        message: OTP_REQUEST_GENERIC_MESSAGE,
      });

      expect(otpRepository.expireActiveByEmail).toHaveBeenCalledWith(
        'sv@stu.ptit.edu.vn',
      );
      expect(mailService.sendOtpEmail).toHaveBeenCalledTimes(1);
      const sentArgs = mailService.sendOtpEmail.mock.calls[0][0];
      expect(sentArgs.to).toBe('sv@stu.ptit.edu.vn');
      expect(sentArgs.code).toMatch(/^\d{6}$/);

      const createdArgs = otpRepository.createOtp.mock.calls[0][0];
      expect(createdArgs.codeHash).not.toContain(sentArgs.code);
      expect(createdArgs.codeHash).toBe(
        hashOtpCode('sv@stu.ptit.edu.vn', sentArgs.code, config.otpHashSecret),
      );
    });

    it('expires the newly created OTP record if mail delivery throws', async () => {
      mailService.sendOtpEmail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(service.requestOtp('sv@ptit.edu.vn')).rejects.toThrow('SMTP down');
      expect(otpRepository.expireById).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      );
    });
  });

  describe('verifyOtp & verifyOtpTicket', () => {
    const email = 'sv@ptit.edu.vn';
    const validCode = '482910';

    const makeOtpRow = (overrides: Partial<OtpVerificationRow> = {}): OtpVerificationRow => ({
      id: '11111111-2222-3333-4444-555555555555',
      email,
      code_hash: hashOtpCode(email, validCode, config.otpHashSecret),
      purpose: 'REGISTER',
      expires_at: new Date(Date.now() + 600_000),
      attempts: 0,
      verified_at: null,
      created_at: new Date(),
      ...overrides,
    });

    it('rejects when no active OTP exists (missing or expired) with 400 OTP_INVALID', async () => {
      otpRepository.findLatestActiveByEmail.mockResolvedValue(null);

      await expect(service.verifyOtp(email, validCode)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.OTP_INVALID },
      });
    });

    it('increments attempts on wrong code and returns 400 OTP_INVALID before maxAttempts', async () => {
      otpRepository.findLatestActiveByEmail.mockResolvedValue(makeOtpRow({ attempts: 2 }));
      otpRepository.incrementAttempts.mockResolvedValue(3);

      await expect(service.verifyOtp(email, '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(otpRepository.incrementAttempts).toHaveBeenCalledWith(
        '11111111-2222-3333-4444-555555555555',
        5,
      );
      expect(otpRepository.markVerified).not.toHaveBeenCalled();
    });

    it('returns 429 OTP_ATTEMPTS_EXCEEDED on the 5th wrong attempt or when already locked', async () => {
      otpRepository.findLatestActiveByEmail.mockResolvedValueOnce(
        makeOtpRow({ attempts: 4 }),
      );
      otpRepository.incrementAttempts.mockResolvedValueOnce(5);

      await expect(service.verifyOtp(email, '000000')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { code: AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED },
      });

      otpRepository.findLatestActiveByEmail.mockResolvedValueOnce(
        makeOtpRow({ attempts: 5 }),
      );
      await expect(service.verifyOtp(email, validCode)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: { code: AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED },
      });
    });

    it('marks OTP verified and issues a valid one-purpose otpTicket on correct code', async () => {
      const row = makeOtpRow();
      otpRepository.findLatestActiveByEmail.mockResolvedValue(row);
      otpRepository.findById.mockResolvedValue({ ...row, verified_at: new Date() });

      const result = await service.verifyOtp('  SV@PTIT.EDU.VN ', validCode);
      expect(result.expiresIn).toBe(600);
      expect(typeof result.otpTicket).toBe('string');
      expect(otpRepository.markVerified).toHaveBeenCalledWith(row.id);

      const decoded = await otpTicketJwt.verifyAsync<OtpTicketPayload>(result.otpTicket);
      expect(decoded).toMatchObject({
        sub: email,
        otpId: row.id,
        typ: 'otp_ticket',
      });

      const verified = await service.verifyOtpTicket(result.otpTicket);
      expect(verified).toEqual({ email, otpId: row.id });
    });

    it('rejects forged, expired, wrong-typ, or unverified otpTickets with 400 OTP_TICKET_INVALID', async () => {
      await expect(service.verifyOtpTicket('not-a-jwt')).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.OTP_TICKET_INVALID },
      });

      // Wrong typ (e.g. access token claims)
      const wrongTyp = await otpTicketJwt.signAsync({
        sub: email,
        otpId: '11111111-2222-3333-4444-555555555555',
        typ: 'access',
      });
      await expect(service.verifyOtpTicket(wrongTyp)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.OTP_TICKET_INVALID },
      });

      // Valid JWT signature, but DB OTP row is not verified
      otpRepository.findById.mockResolvedValue(makeOtpRow({ verified_at: null }));
      const unverifiedTicket = await otpTicketJwt.signAsync({
        sub: email,
        otpId: '11111111-2222-3333-4444-555555555555',
        typ: 'otp_ticket',
      });
      await expect(service.verifyOtpTicket(unverifiedTicket)).rejects.toMatchObject({
        response: { code: AUTH_ERROR_CODES.OTP_TICKET_INVALID },
      });
    });
  });
});

