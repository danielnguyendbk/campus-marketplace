import { AllExceptionsFilter } from './http-exception.filter';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ArgumentsHost,
} from '@nestjs/common';
import { ErrorEnvelope } from '../interfaces/api-response.interface';

/**
 * Validates that an object strictly conforms to OpenAPI v1.2 ErrorEnvelope schema:
 * - root: { error: object, requestId?: string } (additionalProperties: false)
 * - error: { code: string, message: string, details?: Array<{ field?: string, message: string }> } (additionalProperties: false)
 */
function assertConformsToOpenApiErrorEnvelope(body: unknown): asserts body is ErrorEnvelope {
  expect(body).toBeDefined();
  expect(typeof body).toBe('object');
  expect(body).not.toBeNull();

  const obj = body as Record<string, unknown>;

  // Root allowed keys: ONLY 'error' and 'requestId' (additionalProperties: false)
  const allowedRootKeys = new Set(['error', 'requestId']);
  for (const key of Object.keys(obj)) {
    expect(allowedRootKeys.has(key)).toBe(true);
  }

  // Specifically verify absence of legacy/extraneous fields
  expect(obj['success']).toBeUndefined();
  expect(obj['statusCode']).toBeUndefined();
  expect(obj['timestamp']).toBeUndefined();
  expect(obj['path']).toBeUndefined();
  expect(obj['message']).toBeUndefined();

  // Validate error payload
  expect(obj['error']).toBeDefined();
  expect(typeof obj['error']).toBe('object');
  const errorObj = obj['error'] as Record<string, unknown>;

  // error object allowed keys: ONLY 'code', 'message', 'details' (additionalProperties: false)
  const allowedErrorKeys = new Set(['code', 'message', 'details']);
  for (const key of Object.keys(errorObj)) {
    expect(allowedErrorKeys.has(key)).toBe(true);
  }

  expect(typeof errorObj['code']).toBe('string');
  expect(typeof errorObj['message']).toBe('string');

  if (errorObj['details'] !== undefined) {
    expect(Array.isArray(errorObj['details'])).toBe(true);
    for (const detail of errorObj['details'] as Record<string, unknown>[]) {
      const allowedDetailKeys = new Set(['field', 'message']);
      for (const k of Object.keys(detail)) {
        expect(allowedDetailKeys.has(k)).toBe(true);
      }
      expect(typeof detail['message']).toBe('string');
      if (detail['field'] !== undefined) {
        expect(typeof detail['field']).toBe('string');
      }
    }
  }

  if (obj['requestId'] !== undefined) {
    expect(typeof obj['requestId']).toBe('string');
  }
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string; headers: Record<string, string> };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/v1/posts/1',
      headers: { 'x-request-id': 'req-test-123' },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats NotFoundException strictly according to OpenAPI v1.2 ErrorEnvelope', () => {
    const exception = new NotFoundException('Bài đăng không tồn tại');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const sentBody = mockResponse.json.mock.calls[0][0];

    assertConformsToOpenApiErrorEnvelope(sentBody);
    expect(sentBody).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Bài đăng không tồn tại',
      },
      requestId: 'req-test-123',
    });
  });

  it('formats BadRequestException with validation error details without leaking extra fields', () => {
    const validationErrors = ['title must not be empty', 'price must be positive'];
    const exception = new BadRequestException({
      message: validationErrors,
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sentBody = mockResponse.json.mock.calls[0][0];

    assertConformsToOpenApiErrorEnvelope(sentBody);
    expect(sentBody).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'title must not be empty, price must be positive',
        details: [
          { message: 'title must not be empty' },
          { message: 'price must be positive' },
        ],
      },
      requestId: 'req-test-123',
    });
  });

  it('formats ForbiddenException for unverified user correctly and adheres to schema', () => {
    const exception = new ForbiddenException({
      code: 'ACCOUNT_NOT_VERIFIED',
      message: 'Tài khoản chưa được phê duyệt',
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const sentBody = mockResponse.json.mock.calls[0][0];

    assertConformsToOpenApiErrorEnvelope(sentBody);
    expect(sentBody).toEqual({
      error: {
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'Tài khoản chưa được phê duyệt',
      },
      requestId: 'req-test-123',
    });
  });

  it('omits requestId when not present in request headers', () => {
    mockRequest.headers = {};
    const exception = new NotFoundException('Resource missing');
    filter.catch(exception, mockHost);

    const sentBody = mockResponse.json.mock.calls[0][0];
    assertConformsToOpenApiErrorEnvelope(sentBody);
    expect(sentBody.requestId).toBeUndefined();
    expect(Object.keys(sentBody)).toEqual(['error']);
  });

  describe('Security Regression Tests: Safe Public Messages for Non-HttpExceptions', () => {
    it('catches PostgreSQL database errors, returns HTTP 500, and hides DB credentials & connection info', () => {
      // Simulate raw PostgreSQL database connection failure containing credentials and query internals
      const sensitiveDbError = new Error(
        'FATAL: password authentication failed for user "postgres" at connection postgresql://postgres:super_secret_db_password_xyz@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require (SELECT * FROM "users" WHERE "secret_token" = \'tok_12345\')',
      );

      filter.catch(sensitiveDbError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const sentBody = mockResponse.json.mock.calls[0][0];

      assertConformsToOpenApiErrorEnvelope(sentBody);
      expect(sentBody).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        requestId: 'req-test-123',
      });

      // Verify NO sensitive information is leaked anywhere in JSON string
      const jsonString = JSON.stringify(sentBody);
      expect(jsonString).not.toContain('super_secret_db_password_xyz');
      expect(jsonString).not.toContain('postgres');
      expect(jsonString).not.toContain('supabase.com');
      expect(jsonString).not.toContain('tok_12345');
      expect(jsonString).not.toContain('FATAL');
      expect(jsonString).not.toContain('password authentication failed');
    });

    it('catches unexpected runtime exceptions, returns HTTP 500, and hides internal stack trace and variable names', () => {
      // Simulate runtime TypeError with internal variable names and file paths
      const sensitiveRuntimeError = new TypeError(
        "Cannot read properties of undefined (reading 'secret_user_jwt_key') at AuthService.verifyToken (/workspace/src/auth/jwt.service.ts:89:12)",
      );

      filter.catch(sensitiveRuntimeError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const sentBody = mockResponse.json.mock.calls[0][0];

      assertConformsToOpenApiErrorEnvelope(sentBody);
      expect(sentBody).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        requestId: 'req-test-123',
      });

      const jsonString = JSON.stringify(sentBody);
      expect(jsonString).not.toContain('secret_user_jwt_key');
      expect(jsonString).not.toContain('AuthService');
      expect(jsonString).not.toContain('jwt.service.ts');
      expect(jsonString).not.toContain('TypeError');
    });
  });
});
