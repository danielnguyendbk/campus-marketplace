import React from 'react';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../app/App';
import { api, ApiError } from '../services/api';
import { RegisterForm } from '../features/auth/components/register-form';
import { LoginForm } from '../features/auth/components/login-form';
import { createAuthApi, type AuthApi } from '../features/auth/api';
import { MarketplaceHome } from '../features/marketplace/components/marketplace-home';
import { VerificationPage } from '../features/marketplace/components/verification-page';
import { CreatePostPage } from '../features/posts/components/create-post-page';
import { PostDetailPage } from '../features/posts/components/post-detail-page';
import {
  createAuthMockAdapter,
  MOCK_EMAIL,
  MOCK_PASSWORD,
  MOCK_OTP_CODE,
} from '../features/auth/mock-adapter';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigation.replace.mockReset();
});

describe('CMP-39 post creation and detail', () => {
  const id = 'a23ef463-1a6b-4b2d-a330-0e47edff0217';
  const title = 'Giáo trình kiểm thử';
  const date = '2026-11-21T09:00:00Z';

  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:post-fixture');
        static revokeObjectURL = vi.fn();
      },
    );
  });

  async function postSession({
    status = 'APPROVED',
    failCategoriesOnce = false,
    rejectTitle = false,
  }: {
    status?: 'APPROVED' | 'PENDING';
    failCategoriesOnce?: boolean;
    rejectTitle?: boolean;
  } = {}) {
    let created: object | undefined;
    let categoryCalls = 0;
    const success = (data: unknown, status = 200, meta?: object) =>
      Response.json({ success: true, data, timestamp: date, meta }, { status });
    const transport = vi.fn(async (address: string, options?: RequestInit) => {
      const path = new URL(address).pathname;
      if (path.endsWith('/auth/login')) {
        return success({
          accessToken: 'post-test-token',
          tokenType: 'Bearer',
          expiresIn: 600,
          user: { id, displayName: 'Sinh viên test', role: 'USER', verificationStatus: status },
        });
      }
      if (path.endsWith('/categories')) {
        categoryCalls += 1;
        if (failCategoriesOnce && categoryCalls === 1) {
          return Response.json(
            { error: { code: 'SERVER_ERROR', message: 'Lỗi test' } },
            { status: 500 },
          );
        }
        return success([{ id: 'BOOKS', name: 'Giáo trình' }], 200, {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
        });
      }
      if (path.endsWith('/posts') && options?.method === 'POST') {
        if (rejectTitle) {
          return Response.json(
            {
              error: {
                code: 'VALIDATION_FAILED',
                message: 'Sai dữ liệu',
                details: [{ field: 'title', message: 'Hãy đổi tiêu đề.' }],
              },
            },
            { status: 400 },
          );
        }
        const body = options.body as FormData;
        const postType = body.get('postType');
        created = {
          id,
          postType,
          title: body.get('title'),
          categoryId: body.get('categoryId'),
          description: body.get('description'),
          province: body.get('province'),
          status: 'ACTIVE',
          createdAt: date,
          images: [],
          ...(postType === 'SELL'
            ? {
                sellDetail: {
                  price: Number(body.get('price')),
                  condition: body.get('condition'),
                  allowPhoneReveal: false,
                },
              }
            : {
                buyRequestDetail: {
                  budgetMin: Number(body.get('budgetMin')),
                  budgetMax: Number(body.get('budgetMax')),
                },
              }),
        };
        return success(created, 201);
      }
      if (path.endsWith(`/posts/${id}`) && created) return success(created);
      return Response.json(
        { error: { code: 'POST_NOT_FOUND', message: 'Không tìm thấy' } },
        { status: 404 },
      );
    });
    const client = createAuthApi('live', transport);
    await client.login({ email: 'post-test@example.edu.vn', password: 'fixture-only' });
    return { client, transport };
  }

  async function fillCommonFields() {
    await screen.findByRole('option', { name: 'Giáo trình' });
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: title } });
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'BOOKS' } });
    fireEvent.change(screen.getByLabelText('Tỉnh / Thành phố'), {
      target: { value: 'TP. Hồ Chí Minh' },
    });
    fireEvent.change(screen.getByLabelText('Mô tả'), {
      target: { value: 'Dữ liệu đăng tin test.' },
    });
  }

  it('keeps the post form and detail requests inaccessible to a pending student', async () => {
    const { client, transport } = await postSession({ status: 'PENDING' });
    const view = render(<CreatePostPage client={client} />);
    expect(screen.getByText('Cần xác thực sinh viên')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đăng tin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng tin bán' })).not.toBeInTheDocument();
    view.rerender(<PostDetailPage id={id} client={client} />);
    expect(screen.getByText(/Chỉ sinh viên đã được xác thực/)).toBeInTheDocument();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('allows retry when loading real categories fails', async () => {
    const { client } = await postSession({ failCategoriesOnce: true });
    render(<CreatePostPage client={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh mục');
    expect(screen.getByRole('button', { name: 'Đăng tin bán' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    expect(await screen.findByRole('option', { name: 'Giáo trình' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng tin bán' })).toBeEnabled();
  });

  it('requires an image for a SELL post, then shows a link to the created post', async () => {
    const { client, transport } = await postSession();
    render(<CreatePostPage client={client} />);
    await fillCommonFields();
    fireEvent.change(screen.getByLabelText('Giá bán (₫)'), { target: { value: '120000' } });
    fireEvent.change(screen.getByLabelText('Tình trạng sản phẩm'), {
      target: { value: 'Còn tốt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin bán' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Thêm ít nhất một ảnh');
    expect(
      transport.mock.calls.filter(([url]) => new URL(url).pathname.endsWith('/posts')),
    ).toHaveLength(0);

    const photo = new File(['fixture'], 'book.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh'), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin bán' }));
    expect(await screen.findByRole('heading', { name: 'Đã đăng tin' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Xem tin vừa đăng' })).toHaveAttribute(
      'href',
      `/posts/${id}`,
    );
    expect(screen.queryByRole('button', { name: 'Đăng tin bán' })).not.toBeInTheDocument();
  });

  it('validates BUY_REQUEST budgets and loads the resulting post without requiring an image', async () => {
    const { client, transport } = await postSession();
    const view = render(<CreatePostPage client={client} />);
    await fillCommonFields();
    fireEvent.click(screen.getByRole('radio', { name: /Tìm mua/ }));
    expect(screen.queryByLabelText('Giá bán (₫)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ngân sách từ (₫)'), { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText('Ngân sách đến (₫)'), { target: { value: '90000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin tìm mua' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Mức ngân sách đến phải bằng hoặc cao hơn');

    fireEvent.change(screen.getByLabelText('Ngân sách đến (₫)'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin tìm mua' }));
    await screen.findByRole('heading', { name: 'Đã đăng tin' });
    view.rerender(<PostDetailPage id={id} client={client} />);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Tin tìm mua')).toBeInTheDocument();
    expect(screen.getByText('Khoảng ngân sách')).toBeInTheDocument();
    expect(
      transport.mock.calls.filter(([url, init]) => url.endsWith(id) && init?.method === 'GET'),
    ).toHaveLength(1);
  });

  it('preserves the draft and links API validation errors to the affected field', async () => {
    const { client } = await postSession({ rejectTitle: true });
    render(<CreatePostPage client={client} />);
    await fillCommonFields();
    fireEvent.click(screen.getByRole('radio', { name: /Tìm mua/ }));
    fireEvent.change(screen.getByLabelText('Ngân sách từ (₫)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Ngân sách đến (₫)'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng tin tìm mua' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy đổi tiêu đề.');
    expect(screen.getByLabelText('Tiêu đề')).toHaveValue(title);
    expect(screen.getByLabelText('Tiêu đề')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('link', { name: 'Hãy đổi tiêu đề.' })).toHaveAttribute(
      'href',
      '#title',
    );
  });
});

describe('Frontend App Bootstrap & Envelope Integration Tests', () => {
  const mockHealthyEnvelope = {
    success: true,
    data: {
      status: 'ok',
      timestamp: '2026-11-03T06:00:00.000Z',
      uptime: 42.5,
      environment: 'test',
      database: {
        status: 'connected' as const,
        latencyMs: 12,
        version: 'PostgreSQL 17.11',
      },
    },
    timestamp: '2026-11-03T06:00:00.000Z',
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockHealthyEnvelope,
      }),
    );
  });

  it('renders application title and header correctly', async () => {
    render(<App />);
    expect(screen.getByText('Campus Marketplace')).toBeInTheDocument();
    expect(screen.getByText(/Nền tảng mua bán & tìm kiếm đồ dùng sinh viên/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 0: Bootstrap Sẵn sàng/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Backend NestJS đang phản hồi bình thường/i)).toBeInTheDocument();
    });
  });

  it('renders status cards for Monorepo components with unwrapped database status', async () => {
    render(<App />);
    expect(screen.getByText('Frontend Application')).toBeInTheDocument();
    expect(screen.getByText('Database Foundation')).toBeInTheDocument();
    expect(screen.getByText('API Contract (OpenAPI 3.x)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Backend NestJS đang phản hồi bình thường/i)).toBeInTheDocument();
      // Verifies unwrapped database status is displayed
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  describe('Regression Test: Envelope Unwrapping & Error Handling', () => {
    it('automatically unwraps { success, data, timestamp } envelope in api.getHealth()', async () => {
      const data = await api.getHealth();
      expect(data).toBeDefined();
      expect(data.status).toBe('ok');
      expect(data.database.status).toBe('connected');
      expect(data.database.version).toBe('PostgreSQL 17.11');
      // Must not contain the envelope keys directly
      expect((data as unknown as Record<string, unknown>).data).toBeUndefined();
    });

    it('returns the raw envelope via api.getRawHealth() when requested', async () => {
      const envelope = await api.getRawHealth();
      expect(envelope.success).toBe(true);
      expect(envelope.data.status).toBe('ok');
      expect(envelope.timestamp).toBe('2026-11-03T06:00:00.000Z');
    });

    it('handles ApiError envelope when backend returns HTTP error status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({
            error: {
              code: 'FORBIDDEN',
              message: 'Tài khoản chưa được duyệt thẻ sinh viên',
            },
            requestId: 'req-app-403',
          }),
        }),
      );

      await expect(api.getHealth()).rejects.toThrow(ApiError);
      try {
        await api.getHealth();
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.code).toBe('FORBIDDEN');
        expect(apiErr.message).toBe('Tài khoản chưa được duyệt thẻ sinh viên');
      }
    });
  });
});

describe('CMP-29 registration and login UI', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });
  function mockClient() {
    return createAuthApi('mock', createAuthMockAdapter({ delayMs: 0 }));
  }
  async function beginOtp(client: AuthApi = mockClient()) {
    render(<RegisterForm client={client} />);
    fireEvent.change(screen.getByLabelText('Email trường'), {
      target: { value: 'banmoi@ptit.edu.vn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    await screen.findByLabelText('Mã OTP');
    return client;
  }
  async function verifyOtp(client?: AuthApi) {
    const active = await beginOtp(client);
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: MOCK_OTP_CODE } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    await screen.findByLabelText('Mật khẩu', { exact: true });
    return active;
  }
  it('does not open passwords for an invalid school email', () => {
    const client = mockClient();
    const request = vi.spyOn(client, 'requestOtp');
    render(<RegisterForm client={client} />);
    expect(screen.getByLabelText('Email trường').closest('form')).toHaveAttribute('method', 'post');
    fireEvent.change(screen.getByLabelText('Email trường'), {
      target: { value: 'student@gmail.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    expect(
      screen.getByText('Vui lòng sử dụng email trường có tên miền .edu.vn.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('shows loading and keeps the password step closed while waiting for OTP delivery', async () => {
    const client = mockClient();
    let complete!: (value: { success: boolean; message: string }) => void;
    vi.spyOn(client, 'requestOtp').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<RegisterForm client={client} />);
    fireEvent.change(screen.getByLabelText('Email trường'), {
      target: { value: 'student@ptit.edu.vn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    await act(async () => complete({ success: true, message: 'Đã tiếp nhận yêu cầu.' }));
    expect(screen.getByLabelText('Mã OTP')).toBeInTheDocument();
  });
  it('rejects wrong OTP and never opens the password step', async () => {
    await beginOtp();
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã xác thực chưa đúng');
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
  });
  it('handles expired OTP without advancing', async () => {
    let clock = Date.now();
    const client = createAuthApi(
      'mock',
      createAuthMockAdapter({ delayMs: 0, now: () => clock, otpLifetimeMs: 1000 }),
    );
    await beginOtp(client);
    clock += 2000;
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: MOCK_OTP_CODE } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('đã hết hạn');
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
  });
  it('resends OTP, clears the old input, and handles throttling', async () => {
    let clock = Date.now();
    const client = createAuthApi('mock', createAuthMockAdapter({ delayMs: 0, now: () => clock }));
    const resend = vi.spyOn(client, 'requestOtp');
    await beginOtp(client);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều lần');
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '000000' } });
    clock += 31_000;
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
    await waitFor(() => expect(screen.getByLabelText('Mã OTP')).toHaveValue(''));
    expect(resend).toHaveBeenCalledTimes(3);
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
  });
  it('CMP-35 requires a new OTP after attempts are exceeded before opening passwords', async () => {
    const success = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }));
    const attemptsExceeded = () =>
      new Response(
        JSON.stringify({
          error: { code: 'OTP_ATTEMPTS_EXCEEDED', message: 'OTP request rejected' },
        }),
        { status: 429 },
      );
    const transport = vi
      .fn()
      .mockResolvedValueOnce(success({ success: true, message: 'Đã tiếp nhận yêu cầu.' }))
      .mockResolvedValueOnce(attemptsExceeded())
      .mockResolvedValueOnce(attemptsExceeded())
      .mockResolvedValueOnce(success({ success: true, message: 'Đã tiếp nhận yêu cầu mã mới.' }))
      .mockResolvedValueOnce(success({ otpTicket: 'cmp35-test-ticket', expiresIn: 600 }));
    const client = createAuthApi('live', transport);
    const register = vi.spyOn(client, 'register');
    await beginOtp(client);

    for (const code of ['000000', MOCK_OTP_CODE]) {
      fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: code } });
      fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới',
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Xác thực OTP' })).toBeEnabled(),
      );
      expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
    await waitFor(() => expect(screen.getByLabelText('Mã OTP')).toHaveValue(''));
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    expect(await screen.findByLabelText('Mật khẩu', { exact: true })).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(5);
  });
  it('CMP-35 asks users to wait when resending is rate limited and keeps passwords closed', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { success: true, message: 'Đã tiếp nhận yêu cầu.' },
            timestamp: new Date().toISOString(),
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'OTP_RATE_LIMITED', message: 'OTP request rejected' } }),
          { status: 429 },
        ),
      );
    const client = createAuthApi('live', transport);
    const register = vi.spyOn(client, 'register');
    await beginOtp(client);

    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại mã' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn đã yêu cầu mã OTP quá nhiều lần. Vui lòng chờ trước khi gửi lại mã.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('nhập sai OTP');
    expect(screen.getByLabelText('Mã OTP')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('clears verified state when changing email', async () => {
    const client = await verifyOtp();
    const register = vi.spyOn(client, 'register');
    fireEvent.change(screen.getByLabelText('Mật khẩu', { exact: true }), {
      target: { value: 'Sample123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi email' }));
    expect(screen.getByLabelText('Email trường')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
  it('validates password confirmation and sends only contract fields after verification', async () => {
    const client = await verifyOtp();
    const register = vi.spyOn(client, 'register');
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: '  Sinh viên mới  ' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu', { exact: true }), {
      target: { value: 'Sample123!' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(screen.getByText('Mật khẩu xác nhận chưa khớp.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'Sample123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    await screen.findByRole('heading', { name: 'Tạo tài khoản thành công!' });
    const body = register.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['displayName', 'otpTicket', 'password']);
    expect(body.displayName).toBe('Sinh viên mới');
    expect(screen.getByText(/Tài khoản đang ở trạng thái chờ xác thực/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hoàn thiện hồ sơ sinh viên' })).toHaveAttribute(
      'href',
      '/verification',
    );
    expect(navigation.replace).toHaveBeenCalledWith('/verification');
  });
  it('returns to OTP and removes passwords when the verification ticket expires', async () => {
    vi.useFakeTimers();
    const client = createAuthApi('live');
    vi.spyOn(client, 'requestOtp').mockResolvedValue({ success: true, message: 'Đã tiếp nhận.' });
    vi.spyOn(client, 'verifyOtp').mockResolvedValue({
      otpTicket: 'short-lived-ticket',
      expiresIn: 1,
    });
    const register = vi.spyOn(client, 'register');
    render(<RegisterForm client={client} />);
    fireEvent.change(screen.getByLabelText('Email trường'), {
      target: { value: 'student@ptit.edu.vn' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    });
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: MOCK_OTP_CODE } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    });
    expect(screen.getByLabelText('Mật khẩu', { exact: true })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.queryByLabelText('Mật khẩu', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Phiên xác thực đã hết hạn');
    expect(register).not.toHaveBeenCalled();
  });
  it('shows network failure and allows retry without falling back to mock', async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    render(<RegisterForm client={createAuthApi('live', transport)} />);
    fireEvent.change(screen.getByLabelText('Email trường'), {
      target: { value: 'student@ptit.edu.vn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
    expect(screen.getByRole('button', { name: 'Gửi mã xác thực' })).toBeEnabled();
    expect(screen.queryByLabelText('Chế độ mô phỏng')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mã OTP')).not.toBeInTheDocument();
  });
  it('handles duplicate registration while retaining a link to login', async () => {
    const client = createAuthApi('mock', createAuthMockAdapter({ delayMs: 0 }));
    render(<RegisterForm client={client} />);
    fireEvent.change(screen.getByLabelText('Email trường'), { target: { value: MOCK_EMAIL } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));
    fireEvent.change(await screen.findByLabelText('Mã OTP'), { target: { value: MOCK_OTP_CODE } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
    await screen.findByLabelText('Tên hiển thị');
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Duplicate' } });
    for (const label of ['Mật khẩu', 'Xác nhận mật khẩu'])
      fireEvent.change(screen.getByLabelText(label, { exact: true }), {
        target: { value: MOCK_PASSWORD },
      });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email đã có tài khoản');
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
  });
  it('validates empty login and toggles password visibility', () => {
    const client = mockClient();
    const login = vi.spyOn(client, 'login');
    render(<LoginForm client={client} />);
    expect(screen.getByLabelText('Mật khẩu').closest('form')).toHaveAttribute('method', 'post');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('link', { name: 'Đăng ký ngay' })).toHaveAttribute('href', '/register');
  });
  it('handles invalid login then allows successful retry with a PENDING account', async () => {
    render(<LoginForm client={mockClient()} />);
    fireEvent.change(screen.getByLabelText('Email trường'), { target: { value: MOCK_EMAIL } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu chưa đúng');
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: MOCK_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Bạn đã đăng nhập thành công.')).toBeInTheDocument();
    expect(screen.getByText(/Tài khoản đang ở trạng thái chờ xác thực/)).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith('/');
  });
});

describe('Post-authentication home and student verification', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });
  async function signedIn(options: Parameters<typeof createAuthMockAdapter>[0] = {}) {
    const client = createAuthApi('mock', createAuthMockAdapter({ delayMs: 0, ...options }));
    await client.login({ email: MOCK_EMAIL, password: MOCK_PASSWORD });
    return client;
  }
  it('redirects unauthenticated visitors without fetching protected data', async () => {
    const client = createAuthApi('live');
    const feed = vi.spyOn(client, 'getFeed');
    render(<MarketplaceHome client={client} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(feed).not.toHaveBeenCalled();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('lets PENDING users see summaries while locking marketplace actions and detail links', async () => {
    const client = await signedIn();
    render(<MarketplaceHome client={client} />);
    expect(await screen.findByText('Giáo trình Java còn mới')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(
      screen.getByRole('heading', { name: 'Tài khoản đang chờ xác thực sinh viên' }),
    ).toBeInTheDocument();
    for (const name of ['Tìm kiếm', 'Lọc sản phẩm', 'Đăng tin', 'Nhắn tin'])
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDisabled();
    expect(document.querySelector('article a')).toBeNull();
    expect(screen.getByRole('link', { name: /Hoàn thiện hồ sơ/ })).toHaveAttribute(
      'href',
      '/verification',
    );
    expect(screen.getByLabelText('Chế độ mô phỏng')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalledWith('/login');
  });
  it('shows the empty feed state', async () => {
    render(<MarketplaceHome client={await signedIn({ feedItems: [] })} />);
    expect(await screen.findByText('Chưa có tin đăng nào')).toBeInTheDocument();
  });
  it('recovers from a connection error using Retry', async () => {
    const client = await signedIn();
    const feed = vi
      .spyOn(client, 'getFeed')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<MarketplaceHome client={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Giáo trình Java còn mới')).toBeInTheDocument();
    expect(feed).toHaveBeenCalledTimes(2);
  });
  it('clears a rejected session and redirects on HTTP 401', async () => {
    const client = await signedIn();
    vi.spyOn(client, 'getFeed').mockRejectedValue(new ApiError('Expired', 401, 'UNAUTHORIZED'));
    render(<MarketplaceHome client={client} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(client.getSession()).toBeNull();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('keeps forbidden data hidden on HTTP 403', async () => {
    const client = await signedIn();
    vi.spyOn(client, 'getFeed').mockRejectedValue(new ApiError('Forbidden', 403, 'FORBIDDEN'));
    render(<MarketplaceHome client={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('không được phép');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('sends REJECTED accounts to verification without calling feed', async () => {
    const client = await signedIn({ seedVerificationStatus: 'REJECTED' });
    const feed = vi.spyOn(client, 'getFeed');
    render(<MarketplaceHome client={client} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/verification'));
    expect(feed).not.toHaveBeenCalled();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('clears the shared session and protected content on sign out', async () => {
    const client = await signedIn();
    render(<MarketplaceHome client={client} />);
    await screen.findByText('Giáo trình Java còn mới');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(client.getSession()).toBeNull();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith('/login');
  });
  it('validates evidence, submits it, and stays PENDING without exposing card images', async () => {
    const client = await signedIn();
    const submit = vi.spyOn(client, 'submitEvidence');
    render(<VerificationPage client={client} />);
    await screen.findByRole('heading', { name: 'Thông tin sinh viên' });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(screen.getByText('Vui lòng chọn ảnh thẻ sinh viên.')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Trường *'), { target: { value: 'PTIT' } });
    fireEvent.change(screen.getByLabelText('Mã sinh viên *'), { target: { value: 'DEMO001' } });
    const fakeImage = new File(['fake-image'], 'demo-card.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Ảnh thẻ sinh viên *'), {
      target: { files: [fakeImage] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(
      await screen.findByText(/Đã nộp hồ sơ. Bạn có thể xem bảng tin giới hạn/),
    ).toBeInTheDocument();
    expect(client.getSession()?.user.verificationStatus).toBe('PENDING');
    expect(screen.getByRole('link', { name: /Xem bảng tin giới hạn/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ảnh thẻ sinh viên *')).toHaveValue('');
  });
  it('blocks unsupported and oversized evidence before sending it', async () => {
    const client = await signedIn();
    const submit = vi.spyOn(client, 'submitEvidence');
    render(<VerificationPage client={client} />);
    await screen.findByRole('heading', { name: 'Thông tin sinh viên' });
    fireEvent.change(screen.getByLabelText('Trường *'), { target: { value: 'PTIT' } });
    fireEvent.change(screen.getByLabelText('Mã sinh viên *'), { target: { value: 'DEMO001' } });
    fireEvent.change(screen.getByLabelText('Ảnh thẻ sinh viên *'), {
      target: { files: [new File(['text'], 'note.txt', { type: 'text/plain' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(screen.getByText('Vui lòng chọn một tệp ảnh.')).toBeInTheDocument();
    const oversized = new File(['fake-image'], 'demo.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText('Ảnh thẻ sinh viên *'), {
      target: { files: [oversized] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(screen.getByText('Ảnh vượt giới hạn 10 MB.')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
  it('does not expose evidence or upload controls after APPROVED', async () => {
    render(<VerificationPage client={await signedIn({ seedVerificationStatus: 'APPROVED' })} />);
    expect(
      await screen.findByRole('heading', { name: 'Bạn đã được xác thực' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Ảnh thẻ sinh viên *')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('routes a REJECTED login to its verification profile', async () => {
    const client = createAuthApi(
      'mock',
      createAuthMockAdapter({ delayMs: 0, seedVerificationStatus: 'REJECTED' }),
    );
    render(<LoginForm client={client} />);
    fireEvent.change(screen.getByLabelText('Email trường'), { target: { value: MOCK_EMAIL } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: MOCK_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/verification'));
  });
});
