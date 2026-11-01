import { PostgresService } from './postgres.service';

describe('PostgresService', () => {
  let service: PostgresService;

  beforeEach(() => {
    service = new PostgresService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should initialize gracefully when credentials are not configured', async () => {
    const originalUrl = process.env.DATABASE_URL;
    const originalHost = process.env.PGHOST;
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;

    await service.onModuleInit();
    const health = await service.checkHealth();

    expect(health.status).toBe('not_configured');
    expect(health.message).toContain('No DATABASE_URL or PostgreSQL credentials supplied');

    process.env.DATABASE_URL = originalUrl;
    process.env.PGHOST = originalHost;
  });

  it('should throw clear error when query is called without pool configuration', async () => {
    await expect(service.query('SELECT 1')).rejects.toThrow(
      'Database connection pool is not configured',
    );
  });
});
