export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard Single-Entity Success Envelope conforming to OpenAPI v1.2:
 * { success: true, data: T, timestamp: string }
 * Note: additionalProperties: false is enforced in OpenAPI contract.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Standard Paginated Success Envelope conforming to OpenAPI v1.2:
 * { success: true, data: T[], meta: PageMeta, timestamp: string }
 * Note: data and meta are siblings at root level (not nested inside data: { data, meta }).
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PageMeta;
  timestamp: string;
}

/**
 * Input structure returned by controllers/services for paginated results before interceptor wrapping.
 */
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
 * Conforms 100% to openapi.yaml #/components/schemas/ErrorEnvelope:
 * - `error` (required): { code, message, details? }
 * - `requestId` (optional): string
 * `additionalProperties: false` is strictly enforced.
 */
export interface ErrorEnvelope {
  error: ApiErrorPayload;
  requestId?: string;
}

export type ApiErrorResponse = ErrorEnvelope;
