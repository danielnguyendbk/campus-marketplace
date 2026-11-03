import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

@Controller('test-errors')
class TestErrorController {
  @Get('database-failure')
  throwDatabaseError() {
    // Simulates an internal PostgreSQL failure with leaked credentials
    throw new Error(
      'connection to postgresql://postgres:super_secret_db_pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres failed: password authentication failed',
    );
  }

  @Get('runtime-crash')
  throwRuntimeCrash() {
    // Simulates a runtime crash accessing an undefined property
    const obj: unknown = null;
    return (obj as { secret_api_token: string }).secret_api_token;
  }
}

/**
 * Validates strict OpenAPI v1.2 ErrorEnvelope compliance (additionalProperties: false)
 */
function assertConformsToOpenApiErrorEnvelope(body: unknown) {
  expect(body).toBeDefined();
  expect(typeof body).toBe('object');
  expect(body).not.toBeNull();

  const obj = body as Record<string, unknown>;

  // Root level MUST only contain 'error' and optionally 'requestId'
  const allowedRootKeys = new Set(['error', 'requestId']);
  for (const key of Object.keys(obj)) {
    expect(allowedRootKeys.has(key)).toBe(true);
  }

  // Specifically verify absence of legacy/forbidden properties
  expect(obj['success']).toBeUndefined();
  expect(obj['statusCode']).toBeUndefined();
  expect(obj['timestamp']).toBeUndefined();
  expect(obj['path']).toBeUndefined();
  expect(obj['message']).toBeUndefined();

  // Validate error payload
  expect(obj['error']).toBeDefined();
  expect(typeof obj['error']).toBe('object');
  const errorObj = obj['error'] as Record<string, unknown>;

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
    }
  }

  if (obj['requestId'] !== undefined) {
    expect(typeof obj['requestId']).toBe('string');
  }
}

describe('ErrorEnvelope Contract & Security Directives (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OpenAPI Contract Adherence (additionalProperties: false)', () => {
    it('returns strict ErrorEnvelope on 404 Not Found without extraneous fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .set('x-request-id', 'req-contract-404')
        .expect(404);

      assertConformsToOpenApiErrorEnvelope(response.body);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Cannot GET /non-existent-endpoint',
        },
        requestId: 'req-contract-404',
      });
    });

    it('omits requestId when request header is absent', async () => {
      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);

      assertConformsToOpenApiErrorEnvelope(response.body);
      expect(response.body.requestId).toBeUndefined();
      expect(Object.keys(response.body)).toEqual(['error']);
    });
  });

  describe('Security Directives: Protection Against Sensitive Information Leaks', () => {
    it('returns safe HTTP 500 for database error and conceals credentials and DB URLs', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-errors/database-failure')
        .set('x-request-id', 'req-db-fail-500')
        .expect(500);

      assertConformsToOpenApiErrorEnvelope(response.body);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        requestId: 'req-db-fail-500',
      });

      // Strict check: credentials, hostnames, and error details MUST NOT leak anywhere in response
      const rawText = response.text;
      expect(rawText).not.toContain('super_secret_db_pass');
      expect(rawText).not.toContain('aws-0-ap-southeast-1');
      expect(rawText).not.toContain('supabase.com');
      expect(rawText).not.toContain('password authentication failed');
      expect(rawText).not.toContain('postgres');
    });

    it('returns safe HTTP 500 for runtime crash and conceals internal variable names and stack traces', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-errors/runtime-crash')
        .set('x-request-id', 'req-crash-500')
        .expect(500);

      assertConformsToOpenApiErrorEnvelope(response.body);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        requestId: 'req-crash-500',
      });

      const rawText = response.text;
      expect(rawText).not.toContain('secret_api_token');
      expect(rawText).not.toContain('TypeError');
      expect(rawText).not.toContain('at TestErrorController');
    });
  });
});
