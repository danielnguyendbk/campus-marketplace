import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailConfig } from '../../../config/env.config';
import { MAIL_CONFIG } from '../auth.types';
import { MailService } from './mail.service';

@Injectable()
export class SmtpMailService extends MailService {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(@Inject(MAIL_CONFIG) private readonly config: MailConfig) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    });
  }

  async sendOtpEmail(params: {
    to: string;
    code: string;
    expiresInSeconds: number;
  }): Promise<void> {
    const minutes = Math.max(1, Math.round(params.expiresInSeconds / 60));
    await this.transporter.sendMail({
      from: this.config.from,
      to: params.to,
      subject: '[Campus Marketplace] Mã xác thực OTP email sinh viên',
      text: [
        'Xin chào,',
        '',
        `Mã xác thực OTP của bạn là: ${params.code}`,
        `Mã có hiệu lực trong ${minutes} phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`,
        '',
        'Trân trọng,',
        'Campus Marketplace',
      ].join('\n'),
    });
    this.logger.log(`Dispatched OTP email to ${params.to} via SMTP.`);
  }
}

