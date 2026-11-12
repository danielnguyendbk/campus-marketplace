import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '../../config/env.config';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  OTP_REQUEST_GENERIC_MESSAGE,
  OTP_TICKET_JWT,
  OtpTicketPayload,
  SimpleMessage,
  VerifyOtpResult,
} from './auth.types';
import { MailService } from './mail/mail.service';
import { OtpRepository } from './repositories/otp.repository';
import { UserRepository } from './repositories/user.repository';
import { isAllowedSchoolEmail, normalizeEmail } from './utils/email.util';
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCodeHash,
} from './utils/otp-crypto.util';

@Injectable()
export class OtpService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(OTP_TICKET_JWT) private readonly otpTicketJwt: JwtService,
    private readonly otpRepository: OtpRepository,
    private readonly userRepository: UserRepository,
    private readonly mailService: MailService,
  ) {}

  async requestOtp(rawEmail: string): Promise<SimpleMessage> {
    const email = normalizeEmail(rawEmail);

    if (!isAllowedSchoolEmail(email, this.config.allowedSchoolDomains)) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
        message: 'Email phải thuộc tên miền trường đại học được cho phép.',
      });
    }

    // Do not disclose whether an account already exists (OpenAPI contract §/auth/request-otp).
    const alreadyExists = await this.userRepository.existsByEmail(email);
    if (alreadyExists) {
      return {
        success: true,
        message: OTP_REQUEST_GENERIC_MESSAGE,
      };
    }

    const stats = await this.otpRepository.getSendStats(email);
    const now = Date.now();
    if (
      stats.lastSentAt &&
      now - stats.lastSentAt.getTime() < this.config.otpResendCooldownSeconds * 1000
    ) {
      throw new HttpException(
        {
          code: AUTH_ERROR_CODES.OTP_RATE_LIMITED,
          message: 'Vui lòng chờ trước khi yêu cầu mã OTP mới.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (stats.lastHourCount >= this.config.otpMaxPerHour) {
      throw new HttpException(
        {
          code: AUTH_ERROR_CODES.OTP_RATE_LIMITED,
          message: 'Bạn đã vượt quá giới hạn gửi mã OTP. Vui lòng thử lại sau.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.otpRepository.expireActiveByEmail(email);

    const code = generateOtpCode(6);
    const codeHash = hashOtpCode(email, code, this.config.otpHashSecret);
    const expiresAt = new Date(now + this.config.otpTtlSeconds * 1000);

    const created = await this.otpRepository.createOtp({
      email,
      codeHash,
      expiresAt,
    });

    try {
      await this.mailService.sendOtpEmail({
        to: email,
        code,
        expiresInSeconds: this.config.otpTtlSeconds,
      });
    } catch (error) {
      await this.otpRepository.expireById(created.id);
      throw error;
    }

    return {
      success: true,
      message: OTP_REQUEST_GENERIC_MESSAGE,
    };
  }

  async verifyOtp(rawEmail: string, rawCode: string): Promise<VerifyOtpResult> {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.trim();

    if (!isAllowedSchoolEmail(email, this.config.allowedSchoolDomains)) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
        message: 'Email phải thuộc tên miền trường đại học được cho phép.',
      });
    }

    const activeOtp = await this.otpRepository.findLatestActiveByEmail(email);
    if (!activeOtp) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_INVALID,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (activeOtp.attempts >= this.config.otpMaxAttempts) {
      throw new HttpException(
        {
          code: AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
          message: 'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isMatch = verifyOtpCodeHash(
      email,
      code,
      activeOtp.code_hash,
      this.config.otpHashSecret,
    );

    if (!isMatch) {
      const updatedAttempts = await this.otpRepository.incrementAttempts(
        activeOtp.id,
        this.config.otpMaxAttempts,
      );
      if (updatedAttempts === null || updatedAttempts >= this.config.otpMaxAttempts) {
        throw new HttpException(
          {
            code: AUTH_ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
            message: 'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_INVALID,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    const marked = await this.otpRepository.markVerified(activeOtp.id);
    if (!marked) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_INVALID,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    const payload: OtpTicketPayload = {
      sub: email,
      otpId: activeOtp.id,
      typ: 'otp_ticket',
    };

    const otpTicket = await this.otpTicketJwt.signAsync(payload, {
      expiresIn: this.config.otpTtlSeconds,
    });

    return {
      otpTicket,
      expiresIn: this.config.otpTtlSeconds,
    };
  }

  async verifyOtpTicket(otpTicket: string): Promise<{ email: string; otpId: string }> {
    let payload: OtpTicketPayload;
    try {
      payload = await this.otpTicketJwt.verifyAsync<OtpTicketPayload>(otpTicket);
    } catch {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
        message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (
      !payload ||
      payload.typ !== 'otp_ticket' ||
      typeof payload.sub !== 'string' ||
      typeof payload.otpId !== 'string'
    ) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
        message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    const email = normalizeEmail(payload.sub);
    if (!isAllowedSchoolEmail(email, this.config.allowedSchoolDomains)) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
        message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    const otpRow = await this.otpRepository.findById(payload.otpId);
    if (
      !otpRow ||
      normalizeEmail(otpRow.email) !== email ||
      otpRow.verified_at === null
    ) {
      throw new BadRequestException({
        code: AUTH_ERROR_CODES.OTP_TICKET_INVALID,
        message: 'Phiên xác thực OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    return { email, otpId: otpRow.id };
  }
}

