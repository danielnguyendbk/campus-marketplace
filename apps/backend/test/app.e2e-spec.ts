import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PostgresService } from '../src/database/postgres.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PostgresService)
      .useValue({
        checkHealth: jest.fn().mockResolvedValue({
          status: 'connected',
          message: 'PostgreSQL connection healthy',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'api/v1/health'],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) should return 200 with health data wrapped in success envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.version).toBe('1.2.0-bootstrap');
    expect(response.body.data.database).toBeDefined();
  });

  it('/api/v1/health (GET) should also return 200 with health data', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.status).toBe('ok');
  });

  describe('CMP-34: Safe /health responses during DB disconnection', () => {
    it('/health (GET) returns status degraded with safe generic message and no leaked credentials when DB is disconnected', async () => {
      const postgresService = app.get(PostgresService);
      jest.spyOn(postgresService, 'checkHealth').mockResolvedValueOnce({
        status: 'disconnected',
        message: 'Database connection unavailable',
      });

      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database.message).toBe('Database connection unavailable');

      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('postgres');
      expect(jsonStr).not.toContain('authentication failed');
      expect(jsonStr).not.toContain('error');
    });

    it('/api/v1/health (GET) returns status degraded with safe generic message when DB is disconnected', async () => {
      const postgresService = app.get(PostgresService);
      jest.spyOn(postgresService, 'checkHealth').mockResolvedValueOnce({
        status: 'disconnected',
        message: 'Database connection unavailable',
      });

      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database.message).toBe('Database connection unavailable');
    });
  });
});
