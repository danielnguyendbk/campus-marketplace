import type { ApiTransport } from '../../services/api';
import {
  canPublishMarketplacePosts,
  canReadMarketplacePosts,
  emailValidation,
  type AuthSession,
  type VerificationStatus,
} from './types';
import {
  EVIDENCE_MAX_BYTES,
  type FeedItem,
  type MarketplacePreferences,
  type SearchPost,
  type VerificationState,
} from '../marketplace/types';

// Demo-only policy. These values do not define the real backend's OTP policy.
export const MOCK_OTP_CODE = '123456';
export const MOCK_EMAIL = 'sinhvien@ptit.edu.vn';
export const MOCK_APPROVED_EMAIL = 'sinhvien.daduyet@ptit.edu.vn';
export const MOCK_PASSWORD = 'Campus123!';

interface MockOptions {
  delayMs?: number;
  now?: () => number;
  otpLifetimeMs?: number;
  ticketLifetimeSeconds?: number;
  seedVerificationStatus?: VerificationStatus;
  feedItems?: FeedItem[];
}

function bodyObject(body: BodyInit | null | undefined): Record<string, unknown> | null {
  if (typeof body !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
  const profileProvinces = new Map<string, string>();
  const preferences = new Map<string, MarketplacePreferences>();
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
  const categories = [
    { id: 'TEXTBOOK', name: 'Sách và giáo trình' },
    { id: 'ELECTRONICS', name: 'Điện tử và phụ kiện' },
    { id: 'DORM', name: 'Đồ dùng sinh viên' },
  ];
  const searchItems: SearchPost[] = feedItems.map((item, index) => ({
    ...item,
    categoryId: categories[[0, 2, 1, 2, 1, 2][index % 6]].id,
    province: ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'][index % 3],
    status: 'ACTIVE',
    price: item.postType === 'SELL' ? 85000 + 45000 * index : null,
    ...(item.postType === 'BUY_REQUEST' ? { budgetMin: 100000, budgetMax: 250000 } : {}),
  }));
  const demoLampSale = 'a23ef463-1a6b-4b2d-a330-0e47edff0216';
  const demoLampRequest = 'a23ef463-1a6b-4b2d-a330-0e47edff0213';
  const demoListingsWithPhone = new Set(['a23ef463-1a6b-4b2d-a330-0e47edff0210', demoLampSale]);
  const demoSeller = {
    id: 'f355bcb9-d090-4c08-a82e-28b5f4c85121',
    displayName: 'Quang Huy',
    verificationStatus: 'APPROVED',
  };
  const demoMatches = new Map([
    [demoLampSale, demoLampRequest],
    [demoLampRequest, demoLampSale],
  ]);
  if (!options.feedItems) {
    searchItems.push({
      id: demoLampSale,
      title: 'Đèn bàn học LED còn tốt',
      postType: 'SELL',
      categoryId: 'DORM',
      province: 'Hồ Chí Minh',
      status: 'ACTIVE',
      price: 180000,
      thumbnailUrl: null,
      createdAt: new Date(now()).toISOString(),
    });
  }
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
    accounts.set(MOCK_APPROVED_EMAIL, {
      passwordHash,
      user: {
        id: '25c2d144-0282-4d6d-9aa0-4fce3d2094ae',
        displayName: 'Sinh viên đã duyệt',
        role: 'USER',
        verificationStatus: 'APPROVED',
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
  function paginated<T>(items: T[], params: URLSearchParams, defaultLimit = 12) {
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || defaultLimit));
    return Response.json({
      success: true,
      data: items.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) },
      timestamp: new Date(now()).toISOString(),
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
    const readPost = init?.method === 'GET' && /^\/posts\/([^/]+)(\/matches)?$/.exec(route);
    if (
      [
        '/feed',
        '/me',
        '/me/preferences',
        '/me/verification',
        '/me/evidence',
        '/posts',
        '/categories',
      ].includes(route) ||
      readPost
    ) {
      const token = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '') ?? '';
      const authenticated = tokens.get(token);
      if (!authenticated || authenticated.expiresAt <= now())
        return failure(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập lại.');
      const { user } = authenticated;
      if (user.verificationStatus === 'SUSPENDED')
        return failure(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị đình chỉ.');
      if (route === '/me' || route === '/me/preferences') {
        if (
          (init?.method === 'PATCH' || route === '/me/preferences') &&
          !canPublishMarketplacePosts(user)
        )
          return failure(403, 'ACCOUNT_NOT_VERIFIED', 'Tài khoản chưa được xác thực.');
        if (init?.method !== 'GET' && init?.method !== 'PATCH')
          return failure(405, 'METHOD_NOT_ALLOWED', 'Phương thức không hợp lệ.');
        if (route === '/me') {
          if (init?.method === 'PATCH') {
            const body = bodyObject(init.body);
            if (
              !body ||
              Object.keys(body).some((key) => !['displayName', 'province'].includes(key)) ||
              typeof body.displayName !== 'string' ||
              !body.displayName.trim() ||
              body.displayName.length > 255 ||
              typeof body.province !== 'string' ||
              body.province.length > 100
            )
              return failure(400, 'VALIDATION_FAILED', 'Tên hiển thị hoặc tỉnh/thành chưa hợp lệ.');
            user.displayName = body.displayName.trim();
            profileProvinces.set(user.id, body.province.trim());
          }
          const schoolEmail =
            [...accounts].find(([, account]) => account.user.id === user.id)?.[0] ?? MOCK_EMAIL;
          return response({
            ...user,
            schoolEmail,
            province: profileProvinces.get(user.id) ?? null,
            phoneNumber: null,
            school: null,
            major: null,
            className: null,
            studentCode: null,
            cohort: null,
            reputationScore: 5,
            createdAt: new Date(now()).toISOString(),
          });
        }
        if (init?.method === 'PATCH') {
          const body = bodyObject(init.body);
          const ids = body?.favoriteCategoryIds;
          const terms = body?.interestKeywords;
          if (
            !body ||
            Object.keys(body).some(
              (key) => !['favoriteCategoryIds', 'interestKeywords'].includes(key),
            ) ||
            !Array.isArray(ids) ||
            !ids.every((id) => categories.some((category) => category.id === id)) ||
            !Array.isArray(terms) ||
            !terms.every((term) => typeof term === 'string')
          )
            return failure(400, 'VALIDATION_FAILED', 'Danh mục hoặc từ khóa chưa hợp lệ.');
          const interestKeywords = [
            ...new Map(
              terms
                .map((term: string) => term.trim())
                .filter(Boolean)
                .map((term) => [term.toLocaleLowerCase('vi'), term]),
            ).values(),
          ];
          preferences.set(user.id, {
            favoriteCategoryIds: [...new Set(ids)],
            interestKeywords,
            updatedAt: new Date(now()).toISOString(),
          });
        }
        return response(
          preferences.get(user.id) ?? {
            favoriteCategoryIds: [],
            interestKeywords: [],
            updatedAt: new Date(now()).toISOString(),
          },
        );
      }
      if (['/posts', '/categories'].includes(route) || readPost) {
        if (!canReadMarketplacePosts(user))
          return failure(403, 'ACCOUNT_NOT_VERIFIED', 'Tài khoản chưa được xác thực.');
        if (init?.method !== 'GET')
          return failure(501, 'NOT_IMPLEMENTED', 'Chế độ mô phỏng chưa hỗ trợ đăng tin.');
        if (route === '/categories') return paginated(categories, parsedUrl.searchParams);
        if (readPost) {
          const post = searchItems.find((item) => encodeURIComponent(item.id) === readPost[1]);
          if (!post) return failure(404, 'POST_NOT_FOUND', 'Không tìm thấy tin đăng.');
          if (readPost[2]) {
            const counterpartId = options.feedItems ? undefined : demoMatches.get(post.id);
            const counterpart = searchItems.find((item) => item.id === counterpartId);
            const items = counterpart
              ? [
                  {
                    ...counterpart,
                    matchedReasons: ['Cùng danh mục', 'Cùng khu vực', 'Giá phù hợp ngân sách'],
                  },
                ]
              : [];
            return paginated(items, parsedUrl.searchParams);
          }
          return response({
            id: post.id,
            title: post.title,
            postType: post.postType,
            categoryId: post.categoryId,
            province: post.province,
            status: post.status,
            createdAt: post.createdAt,
            owner: demoSeller,
            description: `Tin mô phỏng về ${post.title.toLocaleLowerCase('vi')}.`,
            images: [],
            ...(post.postType === 'SELL'
              ? {
                  sellDetail: {
                    price: post.price,
                    condition: 'Còn tốt',
                    allowPhoneReveal: demoListingsWithPhone.has(post.id),
                  },
                }
              : { buyRequestDetail: { budgetMin: post.budgetMin, budgetMax: post.budgetMax } }),
          });
        }
        const params = parsedUrl.searchParams;
        const keyword = (params.get('q') ?? '').trim().toLocaleLowerCase('vi');
        const type = params.get('type');
        const categoryId = params.get('categoryId');
        const province = params.get('province');
        const min = Number(params.get('min') ?? 0);
        const max = Number(params.get('max') ?? Infinity);
        const matches = searchItems.filter(
          (item) =>
            item.title.toLocaleLowerCase('vi').includes(keyword) &&
            (!type || item.postType === type) &&
            (!categoryId || item.categoryId === categoryId) &&
            (!province || item.province === province) &&
            (item.price ?? item.budgetMax ?? 0) >= min &&
            (item.price ?? item.budgetMin ?? 0) <= max,
        );
        return paginated(matches, params);
      }
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
    const body = bodyObject(init.body);
    if (!body) return failure(400, 'BAD_REQUEST', 'Dữ liệu yêu cầu không hợp lệ.');
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
