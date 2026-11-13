export abstract class MailService {
  abstract sendOtpEmail(params: {
    to: string;
    code: string;
    expiresInSeconds: number;
  }): Promise<void>;
}

