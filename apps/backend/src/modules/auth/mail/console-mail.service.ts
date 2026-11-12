import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Development / test mail transport.
 * Logs OTP delivery to the NestJS logger ONLY when NODE_ENV !== 'production'.
 */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger(ConsoleMailService.name);

  async sendOtpEmail(params: {
    to: string;
    code: string;
    expiresInSeconds: number;
  }): Promise<void> {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      throw new Error('ConsoleMailService must not be used in production.');
    }
    const minutes = Math.round(params.expiresInSeconds / 60);
    this.logger.log(
      `[DEV MAIL] To=${params.to} | OTP=${params.code} (valid for ${minutes} min)`,
    );
  }
}

