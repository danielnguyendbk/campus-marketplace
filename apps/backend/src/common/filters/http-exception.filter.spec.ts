import { AllExceptionsFilter, sanitizeLogMessage } from './http-exception.filter';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ArgumentsHost,
  Logger,
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

describe('sanitizeLogMessage helper', () => {
  it('masks database passwords in connection URLs', () => {
    const raw = 'Failed to connect: postgresql://postgres:mySecretPass123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('mySecretPass123');
    expect(sanitized).toContain('postgresql://postgres:****@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
  });

  it('masks password and token key-values in strings', () => {
    const raw = 'User login failed with password="super_secret_pw" and token: "eyJhbGciOi..."';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('super_secret_pw');
    expect(sanitized).not.toContain('eyJhbGciOi...');
    expect(sanitized).toContain('password="****"');
    expect(sanitized).toContain('token: "****"');
  });

  it('masks Bearer tokens in headers', () => {
    const raw = 'Request auth failed: Bearer secret-jwt-access-token-12345';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('secret-jwt-access-token-12345');
    expect(sanitized).toContain('Bearer ****');
  });
});

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string; headers: Record<string, string> };
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

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

    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    expect(loggerWarnSpy).toHaveBeenCalled();
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

  describe('Security Regression Tests: HTTP 500 Safe Public Messages & Secret Redaction', () => {
    it('catches InternalServerErrorException with sensitive message, returns HTTP 500 with generic message, and sanitizes logs', () => {
      // Simulate developer throwing InternalServerErrorException with SQL query and credentials
      const sensitiveHttpException = new InternalServerErrorException(
        'Internal failure on SELECT * FROM "users" WHERE "password_hash" = "secret_hash_value" at postgresql://postgres:db_pass_123@supabase:5432/postgres',
      );

      filter.catch(sensitiveHttpException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const sentBody = mockResponse.json.mock.calls[0][0];

      // Client response MUST be safe and generic
      assertConformsToOpenApiErrorEnvelope(sentBody);
      expect(sentBody).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        requestId: 'req-test-123',
      });

      const jsonString = JSON.stringify(sentBody);
      expect(jsonString).not.toContain('secret_hash_value');
      expect(jsonString).not.toContain('db_pass_123');
      expect(jsonString).not.toContain('password_hash');
      expect(jsonString).not.toContain('SELECT');

      // Server log MUST redact secrets
      expect(loggerErrorSpy).toHaveBeenCalled();
      const loggedErrorMsg = loggerErrorSpy.mock.calls[0][0];
      expect(loggedErrorMsg).not.toContain('db_pass_123');
      expect(loggedErrorMsg).toContain('postgresql://postgres:****@supabase:5432/postgres');
    });

    it('catches PostgreSQL database errors, returns HTTP 500, hides DB credentials & connection info, and sanitizes logs', () => {
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

      // Server log sanitization check
      expect(loggerErrorSpy).toHaveBeenCalled();
      const loggedMsg = loggerErrorSpy.mock.calls[0][0];
      expect(loggedMsg).not.toContain('super_secret_db_password_xyz');
      expect(loggedMsg).toContain('postgresql://postgres:****@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
      expect(loggedMsg).toContain('"secret_token" = \'****\'');
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
