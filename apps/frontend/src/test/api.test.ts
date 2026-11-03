import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from '../services/api';

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
            success: false,
            statusCode: 403,
            error: {
              code: 'ACCOUNT_NOT_VERIFIED',
              message: 'Tài khoản chưa được phê duyệt',
            },
            timestamp: '2026-11-03T12:00:00.000Z',
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
            success: false,
            statusCode: 400,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'email must be an email',
              details: [{ field: 'email', message: 'email must be an email' }],
            },
            timestamp: '2026-11-03T12:00:00.000Z',
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
});
