import type { ApiTransport } from '../../services/api';
import { emailValidation, type AuthSession, type VerificationStatus } from './types';
import { EVIDENCE_MAX_BYTES, type FeedItem, type VerificationState } from '../marketplace/types';

// Demo-only policy. These values do not define the real backend's OTP policy.
export const MOCK_OTP_CODE = '123456';
export const MOCK_EMAIL = 'sinhvien@ptit.edu.vn';
export const MOCK_PASSWORD = 'Campus123!';

interface MockOptions {
  delayMs?: number;
  now?: () => number;
  otpLifetimeMs?: number;
  ticketLifetimeSeconds?: number;
  seedVerificationStatus?: VerificationStatus;
  feedItems?: FeedItem[];
}

export function createAuthMockAdapter(options: MockOptions = {}): ApiTransport {
  const now = options.now ?? Date.now;
  const otpLifetime = options.otpLifetimeMs ?? 600_000;
  const ticketLifetime = options.ticketLifetimeSeconds ?? 600;
  const otps = new Map<
    string,
    { expiresAt: number; resendAt: number; attempts: number; used: boolean }
  >();
  const tickets = new Map<string, { email: string; expiresAt: number; used: boolean }>();
  const accounts = new Map<string, { passwordHash: string; user: AuthSession['user'] }>();
  const tokens = new Map<string, { user: AuthSession['user']; expiresAt: number }>();
  const verifications = new Map<string, VerificationState>();
  const feedItems: FeedItem[] =
    options.feedItems ??
    [
      'Giáo trình Java còn mới',
      'Bàn học gấp gọn cho phòng trọ',
      'Máy tính cầm tay Casio',
      'Cần tìm đèn bàn học',
      'Tai nghe chụp tai',
      'Kệ sách gỗ nhỏ gọn',
    ].map((title, index) => ({
      id: `a23ef463-1a6b-4b2d-a330-0e47edff021${index}`,
      title,
      postType: index === 3 ? 'BUY_REQUEST' : 'SELL',
      thumbnailUrl: null,
      createdAt: new Date(now() - index * 3_600_000).toISOString(),
    }));
  async function hash(password: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  const seeded = hash(MOCK_PASSWORD).then((passwordHash) => {
    accounts.set(MOCK_EMAIL, {
      passwordHash,
      user: {
        id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
        displayName: 'Sinh viên mẫu',
        role: 'USER',
        verificationStatus: options.seedVerificationStatus ?? 'PENDING',
      },
    });
  });
  function response(data: unknown, status = 200): Response {
    return new Response(
      JSON.stringify({ success: true, data, timestamp: new Date(now()).toISOString() }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
  function failure(status: number, code: string, message: string): Response {
    return new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  function session(user: AuthSession['user']): AuthSession {
    const accessToken = `mock-only-${crypto.randomUUID()}`;
    tokens.set(accessToken, { user, expiresAt: now() + 3_600_000 });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user,
    };
  }

  return async (url, init) => {
    await seeded;
    const delay = options.delayMs ?? 250;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (init?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const parsedUrl = new URL(url);
    const route = parsedUrl.pathname.replace(/^\/api\/v1/, '');
    if (['/feed', '/me/verification', '/me/evidence'].includes(route)) {
      const token = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '') ?? '';
      const authenticated = tokens.get(token);
      if (!authenticated || authenticated.expiresAt <= now())
        return failure(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập lại.');
      const { user } = authenticated;
      if (user.verificationStatus === 'SUSPENDED')
        return failure(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị đình chỉ.');
      if (route === '/feed' && init?.method === 'GET') {
        if (!['PENDING', 'APPROVED'].includes(user.verificationStatus))
          return failure(403, 'ACCOUNT_NOT_VERIFIED', 'Tài khoản chưa được xác thực.');
        if (user.verificationStatus === 'PENDING' && parsedUrl.search)
          return failure(
            403,
            'ACCOUNT_NOT_VERIFIED',
            'Tài khoản chờ duyệt chỉ xem bảng tin giới hạn.',
          );
        const data =
          user.verificationStatus === 'PENDING'
            ? feedItems
            : feedItems.map((item) => ({
                ...item,
                categoryId: 'do-dung-sinh-vien',
                province: 'Hồ Chí Minh',
                status: 'ACTIVE',
              }));
        return new Response(
          JSON.stringify({
            success: true,
            data,
            meta: {
              page: 1,
              limit: Math.max(12, data.length),
              total: data.length,
              totalPages: data.length ? 1 : 0,
            },
            timestamp: new Date(now()).toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (route === '/me/verification' && init?.method === 'GET') {
        return response(verifications.get(user.id) ?? { status: user.verificationStatus });
      }
      if (route === '/me/evidence' && init?.method === 'POST') {
        if (!['PENDING', 'REJECTED'].includes(user.verificationStatus))
          return failure(403, 'FORBIDDEN', 'Tài khoản không thể nộp hồ sơ ở trạng thái hiện tại.');
        const body = init.body;
        if (!(body instanceof FormData))
          return failure(400, 'BAD_REQUEST', 'Hồ sơ cần gửi dạng multipart.');
        const permitted: Record<string, number> = {
          school: 255,
          major: 255,
          className: 100,
          studentCode: 50,
          cohort: 50,
          province: 100,
        };
        for (const [key, value] of body.entries()) {
          if (key === 'cardImage') continue;
          if (!(key in permitted) || typeof value !== 'string' || value.length > permitted[key])
            return failure(400, 'BAD_REQUEST', 'Thông tin hồ sơ chưa hợp lệ.');
        }
        if (
          !String(body.get('school') ?? '').trim() ||
          !String(body.get('studentCode') ?? '').trim()
        )
          return failure(400, 'BAD_REQUEST', 'Vui lòng nhập trường và mã sinh viên.');
        const image = body.get('cardImage');
        if (!image || typeof image === 'string' || image.size === 0)
          return failure(400, 'BAD_REQUEST', 'Vui lòng chọn ảnh thẻ sinh viên.');
        if (image.size > EVIDENCE_MAX_BYTES)
          return failure(413, 'FILE_TOO_LARGE', 'Ảnh vượt giới hạn 10 MB.');
        if (!image.type.startsWith('image/'))
          return failure(415, 'UNSUPPORTED_MEDIA_TYPE', 'Định dạng ảnh không được hỗ trợ.');
        user.verificationStatus = 'PENDING';
        const state: VerificationState = {
          status: 'PENDING',
          submittedAt: new Date(now()).toISOString(),
        };
        verifications.set(user.id, state);
        return response(state, 201);
      }
      return failure(405, 'METHOD_NOT_ALLOWED', 'Phương thức không hợp lệ.');
    }
    if (init?.method !== 'POST')
      return failure(405, 'METHOD_NOT_ALLOWED', 'Phương thức không hợp lệ.');
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(String(init.body));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return failure(400, 'BAD_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const hasOnly = (...fields: string[]) => Object.keys(body).every((key) => fields.includes(key));

    if (route === '/auth/request-otp') {
      if (!hasOnly('email') || emailValidation(email, true)) {
        return failure(
          400,
          'INVALID_EMAIL',
          'Vui lòng sử dụng email trường hợp lệ có tên miền .edu.vn.',
        );
      }
      if ((otps.get(email)?.resendAt ?? 0) > now()) {
        return failure(
          429,
          'TOO_MANY_REQUESTS',
          'Bạn vừa yêu cầu mã. Vui lòng chờ trước khi gửi lại.',
        );
      }
      // One active OTP/ticket per email. Resend invalidates earlier verification tickets.
      for (const ticket of tickets.values()) if (ticket.email === email) ticket.used = true;
      otps.set(email, {
        expiresAt: now() + otpLifetime,
        resendAt: now() + 30_000,
        attempts: 0,
        used: false,
      });
      return response({
        success: true,
        message: 'Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi.',
      });
    }
    if (route === '/auth/verify-otp') {
      if (
        !hasOnly('email', 'code') ||
        typeof body.code !== 'string' ||
        body.code.length < 4 ||
        body.code.length > 12
      ) {
        return failure(400, 'BAD_REQUEST', 'Mã xác thực phải có từ 4 đến 12 ký tự.');
      }
      const otp = otps.get(email);
      if (!otp || otp.expiresAt <= now())
        return failure(400, 'OTP_EXPIRED', 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã.');
      if (otp.used)
        return failure(409, 'OTP_USED', 'Mã xác thực đã được sử dụng. Vui lòng gửi lại mã.');
      if (otp.attempts >= 5)
        return failure(
          429,
          'TOO_MANY_REQUESTS',
          'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.',
        );
      otp.attempts++;
      if (body.code !== MOCK_OTP_CODE)
        return failure(400, 'INVALID_OTP', 'Mã xác thực chưa đúng. Vui lòng thử lại.');
      otp.used = true;
      const otpTicket = `mock-ticket-${crypto.randomUUID()}`;
      tickets.set(otpTicket, { email, expiresAt: now() + ticketLifetime * 1000, used: false });
      return response({ otpTicket, expiresIn: ticketLifetime });
    }
    if (route === '/auth/register') {
      if (
        !hasOnly('otpTicket', 'displayName', 'password') ||
        typeof body.otpTicket !== 'string' ||
        typeof body.displayName !== 'string' ||
        !body.displayName.trim() ||
        body.displayName.length > 255 ||
        typeof body.password !== 'string' ||
        body.password.length < 8
      ) {
        return failure(400, 'BAD_REQUEST', 'Kiểm tra tên hiển thị và mật khẩu tối thiểu 8 ký tự.');
      }
      const ticket = tickets.get(body.otpTicket);
      if (!ticket || ticket.used || ticket.expiresAt <= now()) {
        return failure(
          422,
          'INVALID_OTP_TICKET',
          'Phiên xác thực đã hết hạn hoặc đã được sử dụng. Vui lòng xác thực email lại.',
        );
      }
      if (accounts.has(ticket.email))
        return failure(409, 'EMAIL_EXISTS', 'Email đã có tài khoản. Bạn có thể đăng nhập.');
      ticket.used = true;
      const user: AuthSession['user'] = {
        id: crypto.randomUUID(),
        displayName: body.displayName.trim(),
        role: 'USER',
        verificationStatus: 'PENDING',
      };
      accounts.set(ticket.email, { passwordHash: await hash(body.password), user });
      return response(session(user), 201);
    }
    if (route === '/auth/login') {
      if (
        !hasOnly('email', 'password') ||
        emailValidation(email) ||
        typeof body.password !== 'string' ||
        !body.password
      ) {
        return failure(400, 'BAD_REQUEST', 'Vui lòng nhập email và mật khẩu hợp lệ.');
      }
      const account = accounts.get(email);
      if (!account || account.passwordHash !== (await hash(body.password))) {
        return failure(401, 'UNAUTHORIZED', 'Email hoặc mật khẩu chưa đúng.');
      }
      return response(session(account.user));
    }
    return failure(404, 'NOT_FOUND', 'Không có API mô phỏng cho đường dẫn này.');
  };
}
