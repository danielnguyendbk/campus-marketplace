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
      const name = match[1].trim().replace(/^["']|["']$/g, '') || 'Campus Marketplace';
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
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
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
        padding: 10px 12px 6px 12px !important;
      }
      .cm-subject-pill {
        font-size: 12px !important;
        padding: 5px 10px !important;
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
        padding: 4px 8px 8px 8px !important;
      }
      .cm-greeting {
        font-size: 11px !important;
        line-height: 1.3 !important;
        margin-bottom: 3px !important;
      }
      .cm-otp-box {
        padding: 5px 10px !important;
        margin: 4px auto !important;
        border-radius: 8px !important;
      }
      .cm-otp-code {
        font-size: 19px !important;
        letter-spacing: 4px !important;
      }
      .cm-note {
        font-size: 10px !important;
        line-height: 1.3 !important;
        margin-top: 3px !important;
      }
      .cm-signoff {
        font-size: 10px !important;
        margin-top: 4px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#1d3807;">
  <!-- Full-viewport background wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-height:100vh;background-color:#1d3807;background-image:linear-gradient(180deg,#1849ad 0%,#2159c9 14%,#4e8ef0 42%,#588f1b 45%,#2c540b 75%,#1d3807 100%);">
    <tr>
      <td align="center" valign="top" style="padding:0;">
        <!-- Main responsive stage (max 960px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:960px;margin:0 auto;border-collapse:collapse;">
          
          <!-- ROW 1: SENDER AVATAR, SENDER EMAIL & SUBJECT ON SKY BACKGROUND -->
          <tr>
            <td class="cm-header-pad" style="padding:14px 22px 8px 22px;background-color:#2159c9;background-image:linear-gradient(180deg,#1848ac 0%,#2159c9 100%);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td style="padding-bottom:10px;">
                    <span class="cm-subject-pill" style="display:inline-block;background-color:rgba(11,31,79,0.55);border:1px solid rgba(255,255,255,0.32);border-radius:999px;padding:6px 14px;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                      🐾 [Campus Marketplace] Mã xác thực OTP email sinh viên
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:12px;">
                          <img class="cm-avatar" src="cid:sender-avatar" width="46" height="46" alt="Campus Marketplace Avatar" style="width:46px;height:46px;border-radius:50%;display:block;" />
                        </td>
                        <td valign="middle" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
                          <div class="cm-sender-name" style="font-size:16px;font-weight:700;line-height:1.25;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.4);">
                            ${safeSenderName}
                            <span style="font-size:12px;font-weight:500;color:#dbeafe;">&lt;${safeSenderEmail}&gt;</span>
                          </div>
                          <div class="cm-sender-meta" style="font-size:12px;color:#e0f2fe;line-height:1.35;margin-top:2px;text-shadow:0 1px 2px rgba(0,0,0,0.35);">
                            đến tôi (${safeTo})
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 2: GIANT DOGE CHOMPING THE TOP OF THE OTP FRAME + UPPER SMALL DOGES -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background-color:#2159c9;">
              <img src="cid:scene-top" width="960" alt="Giant Doge Chomping OTP Frame" style="width:100%;max-width:960px;height:auto;display:block;border:0;" />
            </td>
          </tr>

          <!-- ROW 3: LOCKED 24% | 52% | 24% TABLE (LEFT RIFLE DOGE | CHOMPED OTP FRAME | RIGHT SUIT DOGE) -->
          <tr>
            <td style="padding:0;background-color:#1d3807;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background-color:#1d3807;">
                <tr>
                  <!-- Left 24%: Rifle Doge -->
                  <td width="24%" valign="top" style="width:24%;padding:0;line-height:0;font-size:0;background-color:#1d3807;">
                    <img src="cid:scene-left" width="230" alt="" style="width:100%;height:auto;display:block;border:0;" />
                  </td>

                  <!-- Center 52%: Chomped OTP Content Frame -->
                  <td width="52%" valign="middle" style="width:52%;padding:0;background-color:#19380d;background-image:linear-gradient(180deg,#1d4010 0%,#16330b 100%);border-left:5px solid #2b1d0e;border-right:5px solid #2b1d0e;">
                    <div class="cm-frame-inner" style="border-left:3px solid #f5b041;border-right:3px solid #f5b041;padding:6px 18px 10px 18px;text-align:center;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
                      <p class="cm-greeting" style="margin:0 0 6px 0;font-size:14px;line-height:1.4;color:#ecfccb;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.6);">
                        Xin chào, mã xác thực OTP của bạn là:
                      </p>

                      <div class="cm-otp-box" style="display:inline-block;background-color:#0f2407;border:2px dashed #f5b041;border-radius:12px;padding:8px 20px;margin:4px auto 8px auto;box-shadow:0 4px 12px rgba(0,0,0,0.35);">
                        <span class="cm-otp-code" style="font-family:'Courier New',Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:8px;color:#fde047;text-shadow:0 2px 6px rgba(0,0,0,0.75);">
                          ${safeCode}
                        </span>
                      </div>

                      <p class="cm-note" style="margin:0;font-size:13px;line-height:1.45;color:#f7fee7;text-shadow:0 1px 2px rgba(0,0,0,0.6);">
                        Mã có hiệu lực trong <strong style="color:#fde047;">${params.minutes} phút</strong>.<br />
                        Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
                      </p>

                      <p class="cm-signoff" style="margin:8px 0 0 0;font-size:12px;line-height:1.35;color:#bef264;font-weight:600;">
                        Trân trọng, <strong style="color:#ffffff;">Campus Marketplace</strong>
                      </p>
                    </div>
                  </td>

                  <!-- Right 24%: Gentleman Suit Doge -->
                  <td width="24%" valign="top" style="width:24%;padding:0;line-height:0;font-size:0;background-color:#1d3807;">
                    <img src="cid:scene-right" width="230" alt="" style="width:100%;height:auto;display:block;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 4: BOTTOM FRAME BORDER + TWO SCREAMING DOGES ON MEADOW -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background-color:#1d3807;">
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
