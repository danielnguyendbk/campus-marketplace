export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'not_configured';
    latencyMs?: number;
    version?: string;
  };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiPaginatedEnvelope<T> {
  success: true;
  data: T[];
  meta: PageMeta;
  timestamp: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

/**
 * Strict OpenAPI v1.2 ErrorEnvelope.
 * Top-level fields: { error: ApiErrorPayload, requestId?: string }.
 */
export interface ApiErrorEnvelope {
  error: ApiErrorPayload;
  requestId?: string;
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: ApiErrorDetail[];

  constructor(message: string, status: number, code: string = 'UNKNOWN_ERROR', details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000/api/v1';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /**
   * Generic request handler with automatic unwrap of standard single-entity envelope:
   * { success: true, data: T, timestamp: string } -> T
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      if (!res.ok) {
        throw new ApiError(`HTTP error ${res.status}: ${res.statusText}`, res.status, 'HTTP_ERROR');
      }
      throw new ApiError('Invalid JSON response from server', res.status, 'INVALID_JSON');
    }

    if (!res.ok) {
      const errPayload = payload as {
        error?: { code?: string; message?: string; details?: ApiErrorDetail[] } | string;
        message?: string;
      };
      const errorMessage =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.message : undefined) ||
        errPayload?.message ||
        `HTTP error ${res.status}: ${res.statusText}`;
      const errorCode =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.code : undefined) ||
        (typeof errPayload?.error === 'string' ? errPayload?.error : undefined) ||
        'REQUEST_FAILED';
      const details = typeof errPayload?.error === 'object' ? errPayload?.error?.details : undefined;
      throw new ApiError(errorMessage, res.status, errorCode, details);
    }

    // Strictly enforce standard response envelope: { success: true, data: T, timestamp: string }
    const isEnvelope =
      Boolean(payload) &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).success === true &&
      'data' in (payload as Record<string, unknown>) &&
      typeof (payload as Record<string, unknown>).timestamp === 'string';

    if (!isEnvelope) {
      throw new ApiError(
        'Invalid response envelope: response must adhere to { success: true, data, timestamp }',
        res.status,
        'INVALID_RESPONSE_ENVELOPE',
      );
    }

    return (payload as ApiEnvelope<T>).data;
  }

  /**
   * Request paginated endpoint and unwrap into { data: T[], meta: PageMeta }.
   * Strictly validates root-level { success: true, data: T[], meta: PageMeta, timestamp: string }.
   */
  async requestPaginated<T>(endpoint: string, options: RequestInit = {}): Promise<PaginatedResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      if (!res.ok) {
        throw new ApiError(`HTTP error ${res.status}: ${res.statusText}`, res.status, 'HTTP_ERROR');
      }
      throw new ApiError('Invalid JSON response from server', res.status, 'INVALID_JSON');
    }

    if (!res.ok) {
      const errPayload = payload as {
        error?: { code?: string; message?: string; details?: ApiErrorDetail[] } | string;
        message?: string;
      };
      const errorMessage =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.message : undefined) ||
        errPayload?.message ||
        `HTTP error ${res.status}: ${res.statusText}`;
      const errorCode =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.code : undefined) ||
        (typeof errPayload?.error === 'string' ? errPayload?.error : undefined) ||
        'REQUEST_FAILED';
      const details = typeof errPayload?.error === 'object' ? errPayload?.error?.details : undefined;
      throw new ApiError(errorMessage, res.status, errorCode, details);
    }

    const p = payload as Record<string, unknown>;
    const isPaginatedEnvelope =
      Boolean(payload) &&
      typeof payload === 'object' &&
      p.success === true &&
      Array.isArray(p.data) &&
      Boolean(p.meta) &&
      typeof p.meta === 'object' &&
      typeof (p.meta as Record<string, unknown>).page === 'number' &&
      typeof (p.meta as Record<string, unknown>).limit === 'number' &&
      typeof (p.meta as Record<string, unknown>).total === 'number' &&
      typeof (p.meta as Record<string, unknown>).totalPages === 'number' &&
      typeof p.timestamp === 'string';

    if (!isPaginatedEnvelope) {
      throw new ApiError(
        'Invalid paginated response envelope: response must adhere to { success: true, data, meta, timestamp }',
        res.status,
        'INVALID_RESPONSE_ENVELOPE',
      );
    }

    return {
      data: p.data as T[],
      meta: p.meta as PageMeta,
    };
  }

  /**
   * Get health status unwrapped into clean HealthResponse.
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  /**
   * Get full raw envelope for debugging or header verification.
   */
  async getRawHealth(): Promise<ApiEnvelope<HealthResponse>> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new ApiError(`HTTP error ${res.status}: ${res.statusText}`, res.status, 'HTTP_ERROR');
    }
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new ApiError('Invalid JSON response from server', res.status, 'INVALID_JSON');
    }
    const isEnvelope =
      Boolean(payload) &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).success === true &&
      'data' in (payload as Record<string, unknown>) &&
      typeof (payload as Record<string, unknown>).timestamp === 'string';

    if (!isEnvelope) {
      throw new ApiError(
        'Invalid response envelope: response must adhere to { success: true, data, timestamp }',
        res.status,
        'INVALID_RESPONSE_ENVELOPE',
      );
    }
    return payload as ApiEnvelope<HealthResponse>;
  }
}

export const api = new ApiClient();
