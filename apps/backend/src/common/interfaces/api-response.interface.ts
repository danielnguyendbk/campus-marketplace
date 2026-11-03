export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
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
