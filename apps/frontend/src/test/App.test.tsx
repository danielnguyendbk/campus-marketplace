import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../app/App';
import { api, ApiError } from '../services/api';

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
