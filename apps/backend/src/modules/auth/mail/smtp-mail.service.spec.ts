import * as nodemailer from 'nodemailer';
import { SmtpMailService } from './smtp-mail.service';

jest.mock('nodemailer');

describe('SmtpMailService', () => {
  const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  it('sends text fallback, responsive Campus Marketplace HTML template, and inline CID attachments', async () => {
    const service = new SmtpMailService({
      transport: 'smtp',
      from: 'Campus Marketplace <no-reply@campus.local>',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'campus.sender@student.ptithcm.edu.vn',
      smtpPass: 'dummy-pass',
    });

    await service.sendOtpEmail({
      to: 'student@ptithcm.edu.vn',
      code: '482910',
      expiresInSeconds: 600,
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailOptions = sendMailMock.mock.calls[0][0];

    expect(mailOptions.to).toBe('student@ptithcm.edu.vn');
    expect(mailOptions.subject).toBe(
      '[Campus Marketplace] Mã xác thực OTP email sinh viên',
    );
    expect(mailOptions.text).toContain('482910');
    expect(mailOptions.text).toContain('10 phút');

    expect(mailOptions.html).toContain('XÁC THỰC OTP EMAIL SINH VIÊN');
    expect(mailOptions.html).toContain('482910');
    expect(mailOptions.html).toContain('Campus');
    expect(mailOptions.html).toContain('Marketplace');
    expect(mailOptions.html).toContain('cid:sender-avatar');
    expect(mailOptions.html).toContain('cid:illust-left');
    expect(mailOptions.html).toContain('cid:illust-right');
    expect(mailOptions.html).toContain('@media only screen and (max-width: 720px)');
    expect(mailOptions.html).toContain('@media only screen and (max-width: 480px)');

    expect(mailOptions.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cid: 'sender-avatar', filename: 'sender-avatar.png' }),
        expect.objectContaining({ cid: 'illust-left', filename: 'illust-left.jpg' }),
        expect.objectContaining({ cid: 'illust-right', filename: 'illust-right.jpg' }),
      ]),
    );
  });
});
