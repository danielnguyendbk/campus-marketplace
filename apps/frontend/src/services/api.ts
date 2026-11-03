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

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  timestamp: string;
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
   * Generic request handler with automatic unwrap of standard envelope { success, data, timestamp }.
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
