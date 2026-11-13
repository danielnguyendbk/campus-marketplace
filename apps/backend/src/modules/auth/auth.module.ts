import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  AuthConfig,
  getAuthConfig,
  getMailConfig,
  MailConfig,
} from '../../config/env.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ACCESS_TOKEN_JWT,
  AUTH_CONFIG,
  MAIL_CONFIG,
  OTP_TICKET_JWT,
} from './auth.types';
import { ConsoleMailService } from './mail/console-mail.service';
import { MailService } from './mail/mail.service';
import { SmtpMailService } from './mail/smtp-mail.service';
import { OtpService } from './otp.service';
import { OtpRepository } from './repositories/otp.repository';
import { UserRepository } from './repositories/user.repository';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      useFactory: (): AuthConfig => getAuthConfig(),
    },
    {
      provide: MAIL_CONFIG,
      useFactory: (): MailConfig => getMailConfig(),
    },
    {
      provide: ACCESS_TOKEN_JWT,
      useFactory: (config: AuthConfig): JwtService =>
        new JwtService({
          secret: config.jwtSecret,
          signOptions: { algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        }),
      inject: [AUTH_CONFIG],
    },
    {
      provide: OTP_TICKET_JWT,
      useFactory: (config: AuthConfig): JwtService =>
        new JwtService({
          secret: config.otpTicketSecret,
          signOptions: { algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        }),
      inject: [AUTH_CONFIG],
    },
    {
      provide: MailService,
      useFactory: (mailConfig: MailConfig): MailService =>
        mailConfig.transport === 'smtp'
          ? new SmtpMailService(mailConfig)
          : new ConsoleMailService(),
      inject: [MAIL_CONFIG],
    },
    OtpRepository,
    UserRepository,
    OtpService,
    AuthService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    OtpService,
    UserRepository,
    JwtAuthGuard,
    ACCESS_TOKEN_JWT,
    AUTH_CONFIG,
  ],
})
export class AuthModule {}

