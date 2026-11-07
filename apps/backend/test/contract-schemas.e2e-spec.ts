import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, Post, INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PageMeta, PaginatedResult } from '../src/common/interfaces/api-response.interface';

// Mock controllers for contract verification
@Controller('mock-contract')
class MockContractController {
  @Get('single-post')
  getSinglePost() {
    return {
      id: 'a23ef463-1a6b-4b2d-a330-0e47edff0217',
      title: 'Giáo trình Java cơ bản',
      postType: 'SELL',
      status: 'ACTIVE',
      province: 'TP. Hồ Chí Minh',
      sellDetail: {
        price: 120000,
        condition: 'Tốt',
        allowPhoneReveal: true,
      },
    };
  }

  @Post('simple-message')
  getSimpleMessage() {
    return {
      success: true,
      message: 'Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi.',
    };
  }

  @Get('post-page')
  getPostPage(): PaginatedResult<unknown> {
    const meta: PageMeta = {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    };
    return {
      data: [
        {
          id: 'a23ef463-1a6b-4b2d-a330-0e47edff0217',
          title: 'Giáo trình Java',
          postType: 'SELL',
        },
        {
          id: 'b34ef574-2b7c-4c3e-b441-1f58fe001328',
          title: 'Máy tính Casio fx-580VN X',
          postType: 'SELL',
        },
      ],
      meta,
    };
  }

  @Get('empty-category-page')
  getEmptyCategoryPage(): PaginatedResult<unknown> {
    const meta: PageMeta = {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    };
    return {
      data: [],
      meta,
    };
  }
}

function getSchemaBlock(openApiContent: string, schemaName: string): string | null {
  const lines = openApiContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l === `    ${schemaName}:`);
  if (startIdx === -1) return null;
  const blockLines = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].match(/^ {4}[A-Z][A-Za-z0-9]+:/) || lines[i].match(/^[a-z]/)) {
      break;
    }
    blockLines.push(lines[i]);
  }
  return blockLines.join('\n');
}

describe('OpenAPI v1.2 Contract Schemas & Runtime Envelope E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MockContractController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Part 1: Static OpenAPI Contract Spec Verification (openapi.yaml)', () => {
    let openApiContent: string;

    beforeAll(() => {
      const openApiPath = path.resolve(__dirname, '../../../packages/api-contract/openapi.yaml');
      openApiContent = fs.readFileSync(openApiPath, 'utf8');
    });

    const singleEntitySchemas = [
      'SimpleMessageResponse',
      'MeResponse',
      'AuthSessionResponse',
      'VerifyOtpResponse',
      'VerificationResponse',
      'AdminVerificationResponse',
      'PreferenceResponse',
      'PostResponse',
      'PostImageResponse',
      'PhoneRevealResponse',
      'ConversationResponse',
      'MessageResponse',
      'ReportResponse',
      'NotificationResponse',
      'SystemConfigResponse',
      'AdminUserResponse',
    ];

    test.each(singleEntitySchemas)(
      'schema %s must require [success, data, timestamp] with additionalProperties: false',
      (schemaName) => {
        const block = getSchemaBlock(openApiContent, schemaName);
        expect(block).not.toBeNull();
        expect(block).toContain('success:');
        expect(block).toContain('data:');
        expect(block).toContain('timestamp:');
        expect(block).toContain('- success');
        expect(block).toContain('- data');
        expect(block).toContain('- timestamp');
        expect(block).toContain('additionalProperties: false');
      },
    );

    const paginatedSchemas = [
      'CategoryPage',
      'PostPage',
      'PendingFeedPage',
      'ConversationPage',
      'MessagePage',
      'ReportPage',
      'AdminUserPage',
      'AuditLogPage',
      'ReputationEventPage',
      'NotificationPage',
      'SystemConfigPage',
    ];

    test.each(paginatedSchemas)(
      'schema %s must require [success, data, meta, timestamp] with additionalProperties: false',
      (schemaName) => {
        const block = getSchemaBlock(openApiContent, schemaName);
        expect(block).not.toBeNull();
        expect(block).toContain('success:');
        expect(block).toContain('data:');
        expect(block).toContain('meta:');
        expect(block).toContain('timestamp:');
        expect(block).toContain('- success');
        expect(block).toContain('- data');
        expect(block).toContain('- meta');
        expect(block).toContain('- timestamp');
        expect(block).toContain('additionalProperties: false');
      },
    );
  });

  describe('Part 2: Runtime HTTP Response Envelope Validation against OpenAPI Contract', () => {
    it('single entity response conforms strictly to { success: true, data, timestamp }', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/mock-contract/single-post')
        .expect(200);

      const body = response.body;

      // Check required fields
      expect(body.success).toBe(true);
      expect(typeof body.timestamp).toBe('string');
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe('a23ef463-1a6b-4b2d-a330-0e47edff0217');

      // Crucial: STRICT additionalProperties: false check
      // No extra fields are allowed at top level
      expect(Object.keys(body).sort()).toEqual(['data', 'success', 'timestamp']);
    });

    it('simple message response conforms strictly to { success: true, data, timestamp }', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/mock-contract/simple-message')
        .expect(201);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(typeof body.timestamp).toBe('string');
      expect(body.data.success).toBe(true);
      expect(body.data.message).toBe('Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi.');

      // Strict envelope keys
      expect(Object.keys(body).sort()).toEqual(['data', 'success', 'timestamp']);
    });

    it('paginated response conforms strictly to { success: true, data, meta, timestamp } at root', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/mock-contract/post-page')
        .expect(200);

      const body = response.body;

      // Check top-level envelope fields
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta).toBeDefined();
      expect(body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(typeof body.timestamp).toBe('string');
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

      // Verify NO nesting inside data (e.g. data.meta is undefined)
      expect(body.data.meta).toBeUndefined();

      // Crucial: STRICT additionalProperties: false check
      expect(Object.keys(body).sort()).toEqual(['data', 'meta', 'success', 'timestamp']);
    });

    it('empty paginated response conforms strictly to { success: true, data: [], meta, timestamp }', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/mock-contract/empty-category-page')
        .expect(200);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });

      // Strict envelope keys
      expect(Object.keys(body).sort()).toEqual(['data', 'meta', 'success', 'timestamp']);
    });
  });
});
