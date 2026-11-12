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
    const senderInfo = this.parseSender(this.config.from, this.config.smtpUser);

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
        to: params.to,
        code: params.code,
        minutes,
        senderName: senderInfo.name,
        senderEmail: senderInfo.email,
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

  private parseSender(
    fromConfig: string,
    smtpUser?: string,
  ): { name: string; email: string } {
    const match = fromConfig.match(/^(.*?)<([^>]+)>$/);
    if (match) {
      const name =
        match[1].trim().replace(/^["']|["']$/g, '') || 'Campus Marketplace';
      const email = smtpUser || match[2].trim();
      return { name, email };
    }
    return {
      name: 'Campus Marketplace',
      email: smtpUser || fromConfig.trim(),
    };
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
      { filename: 'scene-top.jpg', cid: 'scene-top' },
      { filename: 'scene-left.jpg', cid: 'scene-left' },
      { filename: 'scene-right.jpg', cid: 'scene-right' },
      { filename: 'scene-bottom.jpg', cid: 'scene-bottom' },
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
    to: string;
    code: string;
    minutes: number;
    senderName: string;
    senderEmail: string;
  }): string {
    const safeCode = this.escapeHtml(params.code);
    const safeTo = this.escapeHtml(params.to);
    const safeSenderName = this.escapeHtml(params.senderName);
    const safeSenderEmail = this.escapeHtml(params.senderEmail);

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
    @media only screen and (max-width: 640px) {
      .cm-header-pad {
        padding: 10px 12px 8px 12px !important;
      }
      .cm-sender-name {
        font-size: 14px !important;
      }
      .cm-sender-meta {
        font-size: 11px !important;
      }
      .cm-avatar {
        width: 38px !important;
        height: 38px !important;
      }
      .cm-frame-inner {
        padding: 2px 8px 4px 8px !important;
      }
      .cm-greeting {
        font-size: 11px !important;
        line-height: 1.25 !important;
        margin-bottom: 4px !important;
      }
      .cm-otp-box {
        padding: 4px 12px !important;
        margin: 2px auto 4px auto !important;
        border-radius: 10px !important;
      }
      .cm-otp-code {
        font-size: 19px !important;
        letter-spacing: 5px !important;
      }
      .cm-note {
        font-size: 10px !important;
        line-height: 1.25 !important;
        margin-top: 2px !important;
      }
      .cm-signoff {
        font-size: 10px !important;
        margin-top: 3px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#264b0a;">
  <!-- Full-viewport seamless sky-to-meadow wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-height:100vh;background-color:#264b0a;background-image:linear-gradient(180deg,#1a4cb6 0%,#225ac9 12%,#4e8ef0 42%,#578e1a 46%,#35660e 76%,#264b0a 100%);">
    <tr>
      <td align="center" valign="top" style="padding:0;">
        <!-- Main responsive stage (max 960px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:960px;margin:0 auto;border-collapse:collapse;">
          
          <!-- ROW 1: SENDER AVATAR & SENDER EMAIL DIRECTLY ON THE SKY BACKGROUND -->
          <tr>
            <td class="cm-header-pad" style="padding:14px 24px 10px 24px;background-color:#225ac9;background-image:linear-gradient(180deg,#1a4cb6 0%,#225ac9 100%);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img class="cm-avatar" src="cid:sender-avatar" width="46" height="46" alt="Campus Marketplace Avatar" style="width:46px;height:46px;border-radius:50%;display:block;" />
                  </td>
                  <td valign="middle" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
                    <div class="cm-sender-name" style="font-size:16px;font-weight:700;line-height:1.25;color:#ffffff;text-shadow:0 1px 2px rgba(10,30,75,0.45);">
                      ${safeSenderName}
                      <span style="font-size:13px;font-weight:400;color:#dbeafe;">&lt;${safeSenderEmail}&gt;</span>
                    </div>
                    <div class="cm-sender-meta" style="font-size:12px;color:#e0f2fe;line-height:1.35;margin-top:2px;text-shadow:0 1px 2px rgba(10,30,75,0.35);">
                      đến tôi (${safeTo}) &nbsp;•&nbsp; Mã xác thực OTP email sinh viên
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 2: GIANT DOGE CHOMPING THE WARM CREAM OTP CARD + UPPER SMALL DOGES -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background-color:#225ac9;">
              <img src="cid:scene-top" width="960" alt="Giant Doge Chomping OTP Card" style="width:100%;max-width:960px;height:auto;display:block;border:0;" />
            </td>
          </tr>

          <!-- ROW 3: LOCKED 24% | 52% | 24% TABLE (LEFT RIFLE DOGE | WARM CREAM PARCHMENT CARD | RIGHT SUIT DOGE) -->
          <tr>
            <td style="padding:0;background-color:#33620d;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background-color:#33620d;">
                <tr>
                  <!-- Left 24%: Rifle Doge on Meadow -->
                  <td width="24%" valign="top" style="width:24%;padding:0;line-height:0;font-size:0;background-color:#33620d;">
                    <img src="cid:scene-left" width="230" alt="" style="width:100%;height:auto;display:block;border:0;" />
                  </td>

                  <!-- Center 52%: Warm Cream Parchment Card (#fffcf2) -->
                  <td width="52%" valign="middle" style="width:52%;padding:0;background-color:#fffcf2;background-image:linear-gradient(180deg,#fffcf2 0%,#fff9eb 100%);border-left:3px solid #b45309;border-right:3px solid #b45309;">
                    <div class="cm-frame-inner" style="border-left:2px solid #fcd34d;border-right:2px solid #fcd34d;padding:4px 16px 6px 16px;text-align:center;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
                      <p class="cm-greeting" style="margin:0 0 6px 0;font-size:14px;line-height:1.35;color:#334155;font-weight:700;">
                        Xin chào, mã xác thực OTP sinh viên của bạn là:
                      </p>

                      <div class="cm-otp-box" style="display:inline-block;background-color:#fef3c7;border:2px solid #f59e0b;border-radius:14px;padding:7px 22px;margin:2px auto 8px auto;">
                        <span class="cm-otp-code" style="font-family:'Courier New',Consolas,monospace;font-size:31px;font-weight:800;letter-spacing:8px;color:#92400e;">
                          ${safeCode}
                        </span>
                      </div>

                      <p class="cm-note" style="margin:0;font-size:12.5px;line-height:1.4;color:#475569;">
                        Mã có hiệu lực trong <strong style="color:#b45309;">${params.minutes} phút</strong>. Tuyệt đối không chia sẻ cho bất kỳ ai.
                      </p>

                      <p class="cm-signoff" style="margin:6px 0 0 0;font-size:12px;line-height:1.3;color:#b45309;font-weight:700;">
                        Trân trọng, Campus Marketplace
                      </p>
                    </div>
                  </td>

                  <!-- Right 24%: Gentleman Suit Doge on Meadow -->
                  <td width="24%" valign="top" style="width:24%;padding:0;line-height:0;font-size:0;background-color:#33620d;">
                    <img src="cid:scene-right" width="230" alt="" style="width:100%;height:auto;display:block;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 4: BOTTOM CARD BORDER + TWO SCREAMING DOGES ON CONTINUOUS MEADOW -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background-color:#264b0a;">
              <img src="cid:scene-bottom" width="960" alt="Doge Meadow Footer" style="width:100%;max-width:960px;height:auto;display:block;border:0;" />
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
