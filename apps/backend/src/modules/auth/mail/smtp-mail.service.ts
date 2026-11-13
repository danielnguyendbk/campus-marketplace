import * as fs from 'fs';
import * as path from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailConfig } from '../../../config/env.config';
import { MAIL_CONFIG } from '../auth.types';
import { MailService } from './mail.service';

@Injectable()
export class SmtpMailService extends MailService {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly assetsDir: string;

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
    this.assetsDir = this.resolveAssetsDir();
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
      html: this.buildOtpEmailHtml({
        code: params.code,
        minutes,
      }),
      attachments: this.buildInlineAttachments(),
    });
    this.logger.log(`Dispatched OTP email to ${params.to} via SMTP.`);
  }

  private resolveAssetsDir(): string {
    const candidates = [
      path.join(__dirname, 'assets'),
      path.resolve(process.cwd(), 'src/modules/auth/mail/assets'),
      path.resolve(process.cwd(), 'apps/backend/src/modules/auth/mail/assets'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildInlineAttachments(): nodemailer.SendMailOptions['attachments'] {
    const files = [
      { filename: 'sender-avatar.png', cid: 'sender-avatar' },
      { filename: 'illust-left.jpg', cid: 'illust-left' },
      { filename: 'illust-right.jpg', cid: 'illust-right' },
    ];

    return files
      .map((item) => {
        const filePath = path.join(this.assetsDir, item.filename);
        if (!fs.existsSync(filePath)) {
          return null;
        }
        return {
          filename: item.filename,
          path: filePath,
          cid: item.cid,
          contentDisposition: 'inline' as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  private buildOtpEmailHtml(params: {
    code: string;
    minutes: number;
  }): string {
    const safeCode = this.escapeHtml(params.code);

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>[Campus Marketplace] Mã xác thực OTP email sinh viên</title>
  <style>
    body, table, td, p, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    @media only screen and (max-width: 720px) {
      .cm-header-cell {
        padding: 12px 18px !important;
      }
      .cm-avatar {
        width: 44px !important;
        height: 44px !important;
      }
      .cm-brand-text {
        font-size: 16px !important;
      }
      .cm-side-col {
        width: 20% !important;
      }
      .cm-center-col {
        width: 60% !important;
        padding: 20px 6px !important;
      }
      .cm-card-header {
        padding: 14px 12px !important;
        font-size: 15px !important;
      }
      .cm-card-body {
        padding: 18px 16px 20px 16px !important;
        font-size: 14px !important;
      }
      .cm-otp-box {
        padding: 10px 12px !important;
        margin: 14px 0 18px 0 !important;
      }
      .cm-otp-code {
        font-size: 22px !important;
        letter-spacing: 4px !important;
      }
    }
    @media only screen and (max-width: 480px) {
      .cm-side-col {
        width: 14% !important;
      }
      .cm-center-col {
        width: 72% !important;
        padding: 16px 4px !important;
      }
      .cm-card-header {
        padding: 12px 10px !important;
        font-size: 13px !important;
      }
      .cm-card-body {
        padding: 14px 14px 16px 14px !important;
        font-size: 13px !important;
      }
      .cm-otp-code {
        font-size: 20px !important;
        letter-spacing: 3px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#fef9f5;">
  <!-- Full-bleed wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#fef9f5;">
    
    <!-- ROW 1: FULL-WIDTH ORANGE BRAND HEADER BAR (#f46d1c) -->
    <tr>
      <td align="center" style="background-color:#f46d1c;padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1060px;margin:0 auto;">
          <tr>
            <td class="cm-header-cell" style="padding:14px 36px;background-color:#f46d1c;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:14px;">
                    <img class="cm-avatar" src="cid:sender-avatar" width="52" height="52" alt="Campus Marketplace" style="width:52px;height:52px;border-radius:50%;display:block;" />
                  </td>
                  <td valign="middle" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
                    <div class="cm-brand-text" style="font-size:18px;font-weight:700;line-height:1.2;color:#ffffff;">
                      Campus<br />Marketplace
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ROW 2: MAIN STAGE (LEFT STUDENT ITEMS | CENTER OTP CARD | RIGHT STUDENT ITEMS) -->
    <tr>
      <td align="center" valign="top" style="background-color:#fef9f5;padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1060px;margin:0 auto;table-layout:fixed;background-color:#fef9f5;">
          <tr>
            <!-- Left 27%: Student Items Illustration (Books, Backpack, Laptop, Bicycle) -->
            <td class="cm-side-col" width="27%" valign="bottom" align="left" style="width:27%;padding:0;background-color:#fef9f5;">
              <img src="cid:illust-left" width="286" alt="" style="width:100%;max-width:286px;height:auto;display:block;border:0;" />
            </td>

            <!-- Center 46%: Rounded OTP Card -->
            <td class="cm-center-col" width="46%" valign="middle" align="center" style="width:46%;padding:32px 12px;background-color:#fef9f5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:440px;margin:0 auto;background-color:#ffffff;border:1.5px solid #dec2a8;border-radius:16px;border-collapse:separate;overflow:hidden;box-shadow:0 6px 20px rgba(180,110,50,0.10);">
                <!-- Card Top Peach Header -->
                <tr>
                  <td class="cm-card-header" align="center" style="background-color:#fbe7d6;border-bottom:1px solid #f2d1b3;padding:18px 20px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#1f1c18;letter-spacing:0.3px;border-top-left-radius:14px;border-top-right-radius:14px;">
                    XÁC THỰC OTP EMAIL SINH VIÊN
                  </td>
                </tr>

                <!-- Card Body -->
                <tr>
                  <td class="cm-card-body" align="left" style="padding:24px 28px 26px 28px;background-color:#ffffff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2d2823;border-bottom-left-radius:14px;border-bottom-right-radius:14px;">
                    <p style="margin:0 0 12px 0;color:#2d2823;">
                      Xin chào,
                    </p>

                    <p style="margin:0 0 4px 0;color:#2d2823;">
                      Mã xác thực OTP của bạn là: <strong style="color:#1f1c18;">${safeCode}</strong>
                    </p>
                    <p style="margin:0 0 18px 0;color:#2d2823;">
                      Mã có hiệu lực trong ${params.minutes} phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
                    </p>

                    <!-- Prominent OTP Display Box -->
                    <div class="cm-otp-box" style="background-color:#fffaf5;border:1.5px solid #c89e78;border-radius:10px;padding:12px 16px;text-align:center;margin:0 0 22px 0;">
                      <span class="cm-otp-code" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:4px;color:#1f1c18;">
                        ${safeCode}
                      </span>
                    </div>

                    <p style="margin:0;color:#2d2823;line-height:1.5;">
                      Trân trọng,<br />
                      <strong style="color:#f46d1c;">Campus Marketplace</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>

            <!-- Right 27%: Student Items Illustration (Bicycle, Clothes, Guitar, Boxes) -->
            <td class="cm-side-col" width="27%" valign="bottom" align="right" style="width:27%;padding:0;background-color:#fef9f5;">
              <img src="cid:illust-right" width="286" alt="" style="width:100%;max-width:286px;height:auto;display:block;border:0;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
</body>
</html>`;
  }
}
