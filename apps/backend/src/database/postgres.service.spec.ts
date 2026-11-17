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

  describe('CMP-34: Safe database health check response and sanitized logging', () => {
    it('should return disconnected with generic safe message when database connection fails, masking credentials in response and log', async () => {
      // Simulate pool being configured
      const mockRawError = new Error(
        'FATAL: password authentication failed for user "postgres" at connection postgresql://postgres:super_secret_db_pass@aws.supabase.com:5432/postgres',
      );
      const mockPool = {
        connect: jest.fn().mockRejectedValue(mockRawError),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      // Assign mock pool to service
      (service as unknown as { pool: unknown; isConfigured: boolean }).pool = mockPool;
      (service as unknown as { isConfigured: boolean }).isConfigured = true;

      const loggerWarnSpy = jest
        .spyOn((service as unknown as { logger: { warn: (msg: string) => void } }).logger, 'warn')
        .mockImplementation(() => {});

      const health = await service.checkHealth();

      // Response MUST be generic and safe
      expect(health.status).toBe('disconnected');
      expect(health.message).toBe('Database connection unavailable');

      // Response MUST NOT leak credentials, username, driver details or raw exception message
      const responseStr = JSON.stringify(health);
      expect(responseStr).not.toContain('super_secret_db_pass');
      expect(responseStr).not.toContain('password authentication failed');
      expect(responseStr).not.toContain('postgres');
      expect(responseStr).not.toContain('FATAL');
      expect(responseStr).not.toContain('supabase.com');

      // Logger MUST be called and MUST sanitize secrets
      expect(loggerWarnSpy).toHaveBeenCalled();
      const loggedWarning = loggerWarnSpy.mock.calls[0][0];
      expect(loggedWarning).not.toContain('super_secret_db_pass');
      expect(loggedWarning).toContain('postgresql://postgres:****@aws.supabase.com:5432/postgres');
    });

    it('should return connected status and latency when ping succeeds', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ health: 1 }] }),
        release: jest.fn(),
      };
      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      (service as unknown as { pool: unknown; isConfigured: boolean }).pool = mockPool;
      (service as unknown as { isConfigured: boolean }).isConfigured = true;

      const health = await service.checkHealth();

      expect(health.status).toBe('connected');
      expect(health.message).toBe('PostgreSQL connection healthy');
      expect(typeof health.latencyMs).toBe('number');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
