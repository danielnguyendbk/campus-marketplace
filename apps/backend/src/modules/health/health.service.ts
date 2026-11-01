import { Injectable } from '@nestjs/common';
import { PostgresService, DbStatusInfo } from '../../database/postgres.service';

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: DbStatusInfo;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly postgresService: PostgresService) {}

  async check(): Promise<HealthCheckData> {
    const dbStatus = await this.postgresService.checkHealth();
    const isDegraded = dbStatus.status === 'disconnected';

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      environment: process.env.NODE_ENV || 'development',
      version: '1.2.0-bootstrap',
      database: dbStatus,
    };
  }
}
