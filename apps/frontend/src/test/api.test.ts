import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiClient, ApiError } from '../services/api';
import { webcrypto } from 'node:crypto';
import { createAuthApi } from '../features/auth/api';
import { createAuthMockAdapter, MOCK_OTP_CODE } from '../features/auth/mock-adapter';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ApiClient Request & Envelope Validation Tests', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('http://localhost:3000/api/v1');
    vi.restoreAllMocks();
  });

  it('unwraps valid { success: true, data, timestamp } envelope correctly', async () => {
    const mockEnvelope = {
      success: true,
      data: { id: 'post-123', title: 'Giáo trình Giải tích 1' },
      timestamp: '2026-11-03T12:00:00.000Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockEnvelope,
      }),
    );

    const result = await client.request<{ id: string; title: string }>('/posts/123');
    expect(result).toEqual({ id: 'post-123', title: 'Giáo trình Giải tích 1' });
  });

  describe('Negative Tests: Strict Envelope Rejection on HTTP 200', () => {
    it('rejects flat payload without envelope with INVALID_RESPONSE_ENVELOPE', async () => {
      const flatPayload = { id: 'post-123', title: 'Giáo trình Giải tích 1' };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => flatPayload,
        }),
      );

      await expect(client.request('/posts/123')).rejects.toThrow(ApiError);
      try {
        await client.request('/posts/123');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_RESPONSE_ENVELOPE');
        expect(apiErr.status).toBe(200);
        expect(apiErr.message).toContain('Invalid response envelope');
      }
    });

    it('rejects response with success: false on HTTP 200 with INVALID_RESPONSE_ENVELOPE', async () => {
      const invalidEnvelope = {
        success: false,
        data: null,
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => invalidEnvelope,
        }),
      );

      await expect(client.request('/test')).rejects.toThrow(ApiError);
      try {
        await client.request('/test');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_RESPONSE_ENVELOPE');
      }
    });

    it('rejects response missing "data" property on HTTP 200 with INVALID_RESPONSE_ENVELOPE', async () => {
      const missingData = {
        success: true,
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => missingData,
        }),
      );

      await expect(client.request('/test')).rejects.toThrow(ApiError);
      try {
        await client.request('/test');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_RESPONSE_ENVELOPE');
      }
    });

    it('rejects response missing "timestamp" property on HTTP 200 with INVALID_RESPONSE_ENVELOPE', async () => {
      const missingTimestamp = {
        success: true,
        data: { id: 1 },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => missingTimestamp,
        }),
      );

      await expect(client.request('/test')).rejects.toThrow(ApiError);
      try {
        await client.request('/test');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_RESPONSE_ENVELOPE');
      }
    });

    it('rejects non-JSON response on HTTP 200 with INVALID_JSON instead of returning null', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          },
        }),
      );

      await expect(client.request('/test')).rejects.toThrow(ApiError);
      try {
        await client.request('/test');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_JSON');
        expect(apiErr.status).toBe(200);
      }
    });
  });

  describe('Negative Tests: HTTP Errors & Error Envelopes', () => {
    it('parses structured backend ApiErrorEnvelope correctly on 403 Forbidden', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({
            error: {
              code: 'ACCOUNT_NOT_VERIFIED',
              message: 'Tài khoản chưa được phê duyệt',
            },
            requestId: 'req-403',
          }),
        }),
      );

      await expect(client.request('/posts')).rejects.toThrow(ApiError);
      try {
        await client.request('/posts');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.code).toBe('ACCOUNT_NOT_VERIFIED');
        expect(apiErr.message).toBe('Tài khoản chưa được phê duyệt');
      }
    });

    it('parses validation error details on 400 Bad Request', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'email must be an email',
              details: [{ field: 'email', message: 'email must be an email' }],
            },
            requestId: 'req-400',
          }),
        }),
      );

      try {
        await client.request('/auth/login');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe('VALIDATION_FAILED');
        expect(apiErr.details).toHaveLength(1);
        expect(apiErr.details?.[0].field).toBe('email');
      }
    });

    it('handles non-JSON error response (e.g. 502 Bad Gateway HTML) gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          },
        }),
      );

      await expect(client.request('/posts')).rejects.toThrow(ApiError);
      try {
        await client.request('/posts');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(502);
        expect(apiErr.code).toBe('HTTP_ERROR');
        expect(apiErr.message).toContain('HTTP error 502: Bad Gateway');
      }
    });
  });

  describe('Token management', () => {
    it('attaches Bearer token in Authorization header when token is set', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { status: 'ok' },
          timestamp: '2026-11-03T12:00:00.000Z',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      client.setToken('sample-jwt-token-xyz');
      expect(client.getToken()).toBe('sample-jwt-token-xyz');

      await client.request('/me');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sample-jwt-token-xyz',
          }),
        }),
      );
    });
  });

  describe('requestPaginated Envelope Validation', () => {
    it('unwraps valid root-level { success: true, data, meta, timestamp } paginated envelope', async () => {
      const mockPaginatedEnvelope = {
        success: true,
        data: [
          { id: 'p1', title: 'Sách 1' },
          { id: 'p2', title: 'Sách 2' },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockPaginatedEnvelope,
        }),
      );

      const result = await client.requestPaginated<{ id: string; title: string }>('/posts');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('Sách 1');
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('rejects paginated response if meta is missing', async () => {
      const invalidEnvelope = {
        success: true,
        data: [{ id: 'p1', title: 'Sách 1' }],
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => invalidEnvelope,
        }),
      );

      await expect(client.requestPaginated('/posts')).rejects.toThrow(ApiError);
      try {
        await client.requestPaginated('/posts');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.code).toBe('INVALID_RESPONSE_ENVELOPE');
      }
    });

    it('rejects paginated response if data is not an array', async () => {
      const invalidEnvelope = {
        success: true,
        data: { id: 'single-item' },
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => invalidEnvelope,
        }),
      );

      await expect(client.requestPaginated('/posts')).rejects.toThrow(ApiError);
    });

    it('rejects paginated response if meta fields are incomplete', async () => {
      const invalidEnvelope = {
        success: true,
        data: [{ id: 'p1' }],
        meta: { page: 1 }, // missing limit, total, totalPages
        timestamp: '2026-11-03T12:00:00.000Z',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => invalidEnvelope,
        }),
      );

      await expect(client.requestPaginated('/posts')).rejects.toThrow(ApiError);
    });
  });
});

describe('CMP-29 authentication contract and explicit mock', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });
  const email = 'newstudent@ptit.edu.vn';
  const password = 'Sample123!';
  function setup(options: Parameters<typeof createAuthMockAdapter>[0] = {}) {
    const transport = vi.fn(createAuthMockAdapter({ delayMs: 0, ...options }));
    return { client: createAuthApi('mock', transport), transport };
  }
  async function verified(client: ReturnType<typeof createAuthApi>) {
    await client.requestOtp({ email });
    return client.verifyOtp({ email, code: MOCK_OTP_CODE });
  }
  it('completes registration then login using only the four canonical POST endpoints', async () => {
    const { client, transport } = setup();
    const originalLiveToken = api.getToken();
    const ticket = await verified(client);
    const session = await client.register({
      otpTicket: ticket.otpTicket,
      displayName: 'Sinh viên mới',
      password,
    });
    expect(session.user).toMatchObject({
      role: 'USER',
      verificationStatus: 'PENDING',
      displayName: 'Sinh viên mới',
    });
    client.clearSession();
    const login = await client.login({ email, password });
    expect(login.user.id).toBe(session.user.id);
    expect(api.getToken()).toBe(originalLiveToken);
    expect(transport.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/api/v1/auth/request-otp',
      '/api/v1/auth/verify-otp',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
    ]);
    expect(transport.mock.calls.every(([, init]) => init?.method === 'POST')).toBe(true);
    expect(JSON.parse(String(transport.mock.calls[2][1]?.body))).toEqual({
      otpTicket: ticket.otpTicket,
      displayName: 'Sinh viên mới',
      password,
    });
    expect(JSON.parse(String(transport.mock.calls[3][1]?.body))).toEqual({ email, password });
  });
  it('refuses reused OTP and reused registration tickets', async () => {
    const { client } = setup();
    const ticket = await verified(client);
    await expect(client.verifyOtp({ email, code: MOCK_OTP_CODE })).rejects.toMatchObject({
      status: 409,
      code: 'OTP_USED',
    });
    const body = { otpTicket: ticket.otpTicket, displayName: 'Sinh viên', password };
    await client.register(body);
    await expect(client.register(body)).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_OTP_TICKET',
    });
  });
  it('rejects a fabricated ticket without creating an account', async () => {
    const { client } = setup();
    await expect(
      client.register({ otpTicket: 'fabricated', displayName: 'Sinh viên', password }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(client.login({ email, password })).rejects.toMatchObject({ status: 401 });
  });
  it('invalidates earlier tickets on resend and expires verification tickets', async () => {
    let clock = Date.now();
    const { client } = setup({ now: () => clock, ticketLifetimeSeconds: 1 });
    const first = await verified(client);
    clock += 31_000;
    await client.requestOtp({ email });
    await expect(
      client.register({ otpTicket: first.otpTicket, displayName: 'Sinh viên', password }),
    ).rejects.toMatchObject({ status: 422 });
    const next = await client.verifyOtp({ email, code: MOCK_OTP_CODE });
    clock += 2000;
    await expect(
      client.register({ otpTicket: next.otpTicket, displayName: 'Sinh viên', password }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('limits repeated incorrect OTP attempts', async () => {
    const { client } = setup();
    await client.requestOtp({ email });
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(client.verifyOtp({ email, code: '000000' })).rejects.toMatchObject({
        status: 400,
      });
    }
    await expect(client.verifyOtp({ email, code: MOCK_OTP_CODE })).rejects.toMatchObject({
      status: 429,
    });
  });
  it('still rejects noncanonical envelopes from an injected transport', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { otpTicket: 'ticket', expiresIn: 600 } })),
      );
    const client = createAuthApi('live', transport);
    await expect(client.verifyOtp({ email, code: MOCK_OTP_CODE })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE_ENVELOPE',
    });
  });
  it('does not silently fall back to mock on a live connection failure', async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createAuthApi('live', transport);
    expect(client.mode).toBe('live');
    await expect(client.requestOtp({ email })).rejects.toThrow('Failed to fetch');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each(['SUSPENDED', 'INVALID_STATUS'])(
    'rejects an unsafe authentication status: %s',
    async (verificationStatus) => {
      const transport = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
              accessToken: 'example-only',
              tokenType: 'Bearer',
              expiresIn: 3600,
              user: {
                id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
                displayName: 'Sinh viên',
                role: 'USER',
                verificationStatus,
              },
            },
          }),
        ),
      );
      await expect(
        createAuthApi('live', transport).login({ email, password }),
      ).rejects.toBeInstanceOf(ApiError);
    },
  );
});

describe('Shared session, restricted feed and private evidence contract', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });
  async function signedIn(options: Parameters<typeof createAuthMockAdapter>[0] = {}) {
    const transport = vi.fn(createAuthMockAdapter({ delayMs: 0, ...options }));
    const client = createAuthApi('mock', transport);
    await client.login({ email: 'sinhvien@ptit.edu.vn', password: 'Campus123!' });
    return { client, transport };
  }
  const fields = {
    school: 'PTIT',
    major: 'CNTT',
    className: 'D22',
    studentCode: 'DEMO001',
    cohort: '2022',
    province: 'Hồ Chí Minh',
  };
  it('passes the authenticated token to feed and returns only permitted summary fields', async () => {
    const { client, transport } = await signedIn();
    const page = await client.getFeed();
    expect(page.data).toHaveLength(6);
    expect(Object.keys(page.data[0]).sort()).toEqual([
      'createdAt',
      'id',
      'postType',
      'thumbnailUrl',
      'title',
    ]);
    const [url, init] = transport.mock.calls[1];
    expect(new URL(url).pathname).toBe('/api/v1/feed');
    expect(new URL(url).search).toBe('');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      `Bearer ${client.getSession()?.accessToken}`,
    );
  });
  it('rejects authenticated-only mock routes without a token and blocks pending search', async () => {
    const transport = createAuthMockAdapter({ delayMs: 0 });
    const raw = new ApiClient('http://localhost:3000/api/v1', transport);
    await expect(raw.requestPaginated('/feed', { method: 'GET' })).rejects.toMatchObject({
      status: 401,
    });
    const client = createAuthApi('mock', transport);
    const session = await client.login({ email: 'sinhvien@ptit.edu.vn', password: 'Campus123!' });
    raw.setToken(session.accessToken);
    await expect(raw.requestPaginated('/feed?q=book', { method: 'GET' })).rejects.toMatchObject({
      status: 403,
    });
  });
  it('sends evidence as multipart without forcing a JSON content type, and returns no evidence URL', async () => {
    const { client, transport } = await signedIn();
    const image = new File(['fake-image'], 'demo.png', { type: 'image/png' });
    const result = await client.submitEvidence(fields, image);
    expect(result.status).toBe('PENDING');
    expect(result.submittedAt).toBeTypeOf('string');
    expect(Object.keys(result).sort()).toEqual(['reason', 'status', 'submittedAt']);
    const [url, init] = transport.mock.calls[1];
    expect(new URL(url).pathname).toBe('/api/v1/me/evidence');
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      `Bearer ${client.getSession()?.accessToken}`,
    );
    const body = init?.body as FormData;
    expect(Array.from(body.keys()).sort()).toEqual([
      'cardImage',
      'className',
      'cohort',
      'major',
      'province',
      'school',
      'studentCode',
    ]);
    const state = await client.getVerification();
    expect(state).not.toHaveProperty('cardImageUrl');
    expect(state).not.toHaveProperty('cardImageRef');
  });
  it('allows REJECTED evidence resubmission to become PENDING, never APPROVED automatically', async () => {
    const { client } = await signedIn({ seedVerificationStatus: 'REJECTED' });
    expect(client.getSession()?.user.verificationStatus).toBe('REJECTED');
    await expect(client.getFeed()).rejects.toMatchObject({ status: 403 });
    await client.submitEvidence(fields, new File(['fake'], 'demo.png', { type: 'image/png' }));
    expect(client.getSession()?.user.verificationStatus).toBe('PENDING');
    await expect(client.getFeed()).resolves.toMatchObject({ meta: { total: 6 } });
  });
  it('rejects malformed verification and feed data instead of showing an authenticated success', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: 'UNKNOWN' },
          timestamp: new Date().toISOString(),
        }),
      ),
    );
    const client = createAuthApi('live', transport);
    await expect(client.getVerification()).rejects.toMatchObject({ code: 'INVALID_RESPONSE_DATA' });
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ id: 'x' }],
          meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
          timestamp: new Date().toISOString(),
        }),
      ),
    );
    await expect(client.getFeed()).rejects.toMatchObject({ code: 'INVALID_RESPONSE_DATA' });
  });
  it('expires the shared session using expiresIn and notifies subscribers', async () => {
    vi.useFakeTimers();
    try {
      const transport = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'example-only',
              tokenType: 'Bearer',
              expiresIn: 1,
              user: {
                id: '0d8d830e-11bd-440a-b72e-24c8bd3a519a',
                displayName: 'Sinh viên',
                role: 'USER',
                verificationStatus: 'PENDING',
              },
            },
            timestamp: new Date().toISOString(),
          }),
        ),
      );
      const client = createAuthApi('live', transport);
      const notify = vi.fn();
      client.subscribe(notify);
      await client.login({ email: 'student@ptit.edu.vn', password: 'sample-only' });
      expect(client.getSession()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1001);
      expect(client.getSession()).toBeNull();
      expect(notify).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
