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

  it('sends both text fallback, responsive Doge HTML template, and inline CID attachments', async () => {
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

    expect(mailOptions.html).toContain('482910');
    expect(mailOptions.html).toContain('Campus Marketplace');
    expect(mailOptions.html).toContain('campus.sender@student.ptithcm.edu.vn');
    expect(mailOptions.html).toContain('đến tôi (student@ptithcm.edu.vn)');
    expect(mailOptions.html).toContain('cid:sender-avatar');
    expect(mailOptions.html).toContain('cid:scene-top');
    expect(mailOptions.html).toContain('cid:scene-left');
    expect(mailOptions.html).toContain('cid:scene-right');
    expect(mailOptions.html).toContain('cid:scene-bottom');
    expect(mailOptions.html).toContain('@media only screen and (max-width: 640px)');

    expect(mailOptions.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cid: 'sender-avatar', filename: 'sender-avatar.png' }),
        expect.objectContaining({ cid: 'scene-top', filename: 'scene-top.jpg' }),
        expect.objectContaining({ cid: 'scene-left', filename: 'scene-left.jpg' }),
        expect.objectContaining({ cid: 'scene-right', filename: 'scene-right.jpg' }),
        expect.objectContaining({ cid: 'scene-bottom', filename: 'scene-bottom.jpg' }),
      ]),
    );
  });
});
