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
import { AdminVerificationPage } from '../features/marketplace/components/admin-verification-page';
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
      target: { files: [new File(['example'], 'card.webp', { type: 'image/webp' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(screen.getByText('Vui lòng chọn ảnh JPG, JPEG hoặc PNG.')).toBeInTheDocument();
    const oversized = new File(['fake-image'], 'demo.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText('Ảnh thẻ sinh viên *'), {
      target: { files: [oversized] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(screen.getByText('Ảnh vượt giới hạn 10 MB.')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
  it('shows the rejection reason and returns to PENDING after submitting new evidence', async () => {
    const client = await signedIn({ seedVerificationStatus: 'REJECTED' });
    const reason = 'Ảnh thẻ chưa rõ thông tin.';
    vi.spyOn(client, 'getVerification').mockResolvedValueOnce({
      status: 'REJECTED',
      reason,
      submittedAt: '2026-11-19T01:00:00.000Z',
    });
    render(<VerificationPage client={client} />);
    await screen.findByRole('heading', { name: 'Cập nhật và nộp lại hồ sơ' });
    expect(screen.getByText(`Lý do: ${reason}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Trường *'), { target: { value: 'PTIT' } });
    fireEvent.change(screen.getByLabelText('Mã sinh viên *'), { target: { value: 'DEMO001' } });
    const image = new File(['fake-image'], 'new-card.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Ảnh thẻ sinh viên *'), {
      target: { files: [image] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nộp hồ sơ xác thực' }));
    expect(await screen.findByText('Chờ xác thực')).toBeInTheDocument();
    expect(screen.queryByText(`Lý do: ${reason}`)).not.toBeInTheDocument();
    expect(client.getSession()?.user.verificationStatus).toBe('PENDING');
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

describe('CMP-38 Admin verification', () => {
  const id = '752b305d-bdc8-4e14-93ee-5103dcd810f1';
  const date = '2026-11-20T01:00:00.000Z';
  const imageEndpoint = '/api/v1/admin/verifications/download';
  const fakeImageUrl =
    imageEndpoint + '?ref=fake-reference&expires=1795230000000&token=fake-fixture';
  const renewedImageUrl = fakeImageUrl.replace('fake-fixture', 'renewed-fixture');
  const createObjectUrl = vi.fn(() => 'blob:fixture-preview');
  const revokeObjectUrl = vi.fn();

  beforeEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectUrl;
        static revokeObjectURL = revokeObjectUrl;
      },
    );
  });

  const sample = {
    id,
    status: 'PENDING',
    displayName: 'Sinh viên kiểm thử',
    schoolEmail: 'fixture@ptit.edu.vn',
    school: 'PTIT',
    studentCode: 'DEMO001',
    cardImageUrl: fakeImageUrl,
    submittedAt: date,
    reviewedAt: null as string | null,
    reason: null as string | null,
  };

  async function setup({
    role = 'ADMIN',
    listFailure,
    initialStatus = 200,
    paginated = false,
    reviewFailure,
    detailFailure,
    expiredImage = false,
  }: {
    role?: 'ADMIN' | 'USER';
    listFailure?: 401 | 403;
    initialStatus?: 200 | 500;
    paginated?: boolean;
    reviewFailure?: 500;
    detailFailure?: 404;
    expiredImage?: boolean;
  } = {}) {
    let record = { ...sample };
    let listCalls = 0;
    let detailReads = 0;
    function success(data: unknown, meta?: object) {
      return new Response(JSON.stringify({ success: true, data, timestamp: date, meta }));
    }
    function failure(status: number, code = 'FAILED') {
      return new Response(JSON.stringify({ error: { code, message: 'Yêu cầu thất bại' } }), {
        status,
      });
    }
    const transport = vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      if (url.pathname.endsWith('/auth/login'))
        return success({
          accessToken: 'fixture-token',
          tokenType: 'Bearer',
          expiresIn: 600,
          user: {
            id: '67611d65-a830-43a2-8f3f-a81796f19288',
            displayName: 'Người kiểm thử',
            role,
            verificationStatus: 'APPROVED',
          },
        });
      if (url.pathname.endsWith('/admin/verifications')) {
        listCalls += 1;
        const status = listFailure ?? (listCalls === 1 ? initialStatus : 200);
        if (status !== 200) return failure(status);
        const page = Number(url.searchParams.get('page'));
        const filter = url.searchParams.get('status');
        const rows = !filter || filter === record.status ? [record] : [];
        const totalPages = paginated ? 2 : rows.length;
        return success(rows, { page, limit: 20, total: paginated ? 21 : rows.length, totalPages });
      }
      if (url.pathname === imageEndpoint) {
        if (expiredImage && url.searchParams.get('token') === 'fake-fixture')
          return failure(403, 'LINK_EXPIRED');
        return new Response('fake-image', { headers: { 'Content-Type': 'image/png' } });
      }
      if (url.pathname.endsWith('/admin/verifications/' + id)) {
        if (init?.method === 'GET') {
          if (detailFailure) return failure(detailFailure);
          detailReads += 1;
          if (expiredImage && detailReads > 1)
            return success({ ...record, cardImageUrl: renewedImageUrl });
        }
        if (init?.method === 'PATCH') {
          if (reviewFailure) return failure(reviewFailure);
          const submitted = JSON.parse(String(init.body));
          record = {
            ...record,
            status: submitted.decision,
            reviewedAt: date,
            reason: submitted.reason ?? null,
          };
        }
        return success(record);
      }
      throw new Error('Unexpected verification request');
    });
    const client = createAuthApi('live', transport);
    await client.login({ email: 'fixture@ptit.edu.vn', password: 'fixture-only' });
    const view = render(<AdminVerificationPage client={client} />);
    return { client, transport, view };
  }

  async function openDetail() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xem hồ sơ của Sinh viên kiểm thử' }),
    );
    await screen.findByRole('heading', { name: 'Sinh viên kiểm thử' });
  }

  it('lists only pending records by default, retries a failed load, and supports pagination and filters', async () => {
    const { transport } = await setup({ initialStatus: 500, paginated: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Hệ thống đang gặp sự cố');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('21 hồ sơ · Trang 1/2')).toBeInTheDocument();
    const [url, init] = transport.mock.calls[1];
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
      page: '1',
      limit: '20',
      status: 'PENDING',
    });
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer fixture-token' });
    expect(init?.cache).toBe('no-store');
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('21 hồ sơ · Trang 2/2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'APPROVED' } });
    expect(await screen.findByText('Không có hồ sơ phù hợp.')).toBeInTheDocument();
    expect(new URL(transport.mock.lastCall![0]).searchParams.toString()).toBe(
      'page=1&limit=20&status=APPROVED',
    );
  });

  it('requires approval confirmation and refreshes the queue', async () => {
    const { transport } = await setup();
    expect(screen.getByRole('link', { name: 'Xét duyệt hồ sơ' })).toHaveAttribute(
      'href',
      '/admin/verifications',
    );
    await openDetail();
    expect(screen.getByText('DEMO001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }));
    expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    expect(await screen.findByText('Đã duyệt hồ sơ.')).toBeInTheDocument();
    expect(await screen.findByText('Không có hồ sơ chờ xét duyệt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt hồ sơ' })).not.toBeInTheDocument();
    const mutation = transport.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(mutation?.[1]?.body).toBe(JSON.stringify({ decision: 'APPROVED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(screen.getByRole('heading', { name: 'Danh sách hồ sơ' })).toHaveFocus();
  });

  it('renders authenticated evidence only in detail and releases the image on return to the queue', async () => {
    const { transport, view } = await setup();
    await screen.findByRole('button', { name: 'Xem hồ sơ của Sinh viên kiểm thử' });
    expect(transport.mock.calls.some(([url]) => url.includes(imageEndpoint))).toBe(false);
    expect(view.container.innerHTML).not.toContain(fakeImageUrl);

    await openDetail();
    const image = await screen.findByRole('img', { name: 'Ảnh minh chứng sinh viên' });
    expect(image).toHaveAttribute('src', 'blob:fixture-preview');
    expect(view.container.innerHTML).not.toContain(fakeImageUrl);
    const evidenceRequest = transport.mock.calls.find(([url]) => url.includes(imageEndpoint));
    expect(evidenceRequest?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer fixture-token' },
      cache: 'no-store',
      redirect: 'error',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(evidenceRequest?.[1]?.signal?.aborted).toBe(true);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:fixture-preview');
  });

  it('requests a fresh signed link when retrying an expired image and preserves Admin access', async () => {
    const { transport } = await setup({ expiredImage: true });
    await openDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('Liên kết ảnh đã hết hạn');
    expect(screen.getByRole('button', { name: 'Duyệt hồ sơ' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải lại ảnh' }));
    expect(
      await screen.findByRole('img', { name: 'Ảnh minh chứng sinh viên' }),
    ).toBeInTheDocument();
    const downloads = transport.mock.calls.filter(([url]) => url.includes(imageEndpoint));
    expect(downloads.map(([url]) => new URL(url).searchParams.get('token'))).toEqual([
      'fake-fixture',
      'renewed-fixture',
    ]);
  });

  it('rejects blank or oversized reasons and sends the trimmed reason on confirmation', async () => {
    const { transport } = await setup();
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    const reason = screen.getByLabelText('Lý do từ chối (bắt buộc)');
    fireEvent.change(reason, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nhập lý do từ chối');
    expect(reason).toHaveFocus();
    fireEvent.change(reason, { target: { value: 'a'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(screen.getByRole('alert')).toHaveTextContent('tối đa 500 ký tự');
    expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    fireEvent.change(reason, { target: { value: '  Ảnh thẻ chưa rõ.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(await screen.findByText('Đã từ chối hồ sơ.')).toBeInTheDocument();
    expect(screen.getByText('Ảnh thẻ chưa rõ.')).toBeInTheDocument();
    const mutation = transport.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(mutation?.[1]?.body).toBe(
      JSON.stringify({ decision: 'REJECTED', reason: 'Ảnh thẻ chưa rõ.' }),
    );
  });

  it('requires a fresh detail read after an uncertain review response', async () => {
    const { transport } = await setup({ reviewFailure: 500 });
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt hồ sơ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa xác nhận được kết quả');
    expect(screen.queryByRole('button', { name: 'Xác nhận duyệt' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại hồ sơ' }));
    await screen.findByRole('button', { name: 'Duyệt hồ sơ' });
    expect(transport.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
    expect(
      transport.mock.calls.filter(([url, init]) => url.endsWith(id) && init?.method === 'GET'),
    ).toHaveLength(2);
  });

  it('keeps the Admin entry and requests inaccessible to USER accounts', async () => {
    const { transport } = await setup({ role: 'USER' });
    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xét duyệt hồ sơ.');
    expect(screen.queryByRole('link', { name: 'Xét duyệt hồ sơ' })).not.toBeInTheDocument();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('offers retry and a way back if the selected record is no longer available', async () => {
    const { transport } = await setup({ detailFailure: 404 });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xem hồ sơ của Sinh viên kiểm thử' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy hồ sơ này.');
    expect(screen.queryByRole('button', { name: 'Duyệt hồ sơ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('alert');
    expect(transport.mock.calls.filter(([url]) => url.endsWith(id))).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(screen.getByRole('heading', { name: 'Danh sách hồ sơ' })).toHaveFocus();
  });

  it('redirects guests without requesting verification records', async () => {
    const transport = vi.fn();
    render(<AdminVerificationPage client={createAuthApi('live', transport)} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(transport).not.toHaveBeenCalled();
  });

  it('clears the session on HTTP 401 and redirects to login', async () => {
    const { client } = await setup({ listFailure: 401 });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(client.getSession()).toBeNull();
  });

  it('shows access denied when the backend rejects an Admin session with HTTP 403', async () => {
    const { client } = await setup({ listFailure: 403 });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền xét duyệt hồ sơ.',
    );
    expect(screen.queryByRole('heading', { name: 'Danh sách hồ sơ' })).not.toBeInTheDocument();
    expect(client.getSession()).not.toBeNull();
  });
});
