import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PostgresService } from '../../database/postgres.service';

describe('HealthController', () => {
  let healthController: HealthController;
  let postgresService: PostgresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PostgresService,
          useValue: {
            checkHealth: jest.fn().mockResolvedValue({
              status: 'not_configured',
              message: 'No DATABASE_URL supplied in environment',
            }),
          },
        },
      ],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
    postgresService = module.get<PostgresService>(PostgresService);
  });

  it('should be defined', () => {
    expect(healthController).toBeDefined();
  });

  it('should return health status ok even if DB is not configured', async () => {
    const result = await healthController.getHealth();
    expect(result).toBeDefined();
    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('not_configured');
    expect(result.version).toBe('1.2.0-bootstrap');
  });

  it('should return degraded if database is disconnected with safe generic message', async () => {
    jest.spyOn(postgresService, 'checkHealth').mockResolvedValueOnce({
      status: 'disconnected',
      message: 'Database connection unavailable',
    });

    const result = await healthController.getHealth();
    expect(result.status).toBe('degraded');
    expect(result.database.status).toBe('disconnected');
    expect(result.database.message).toBe('Database connection unavailable');
  });
});
