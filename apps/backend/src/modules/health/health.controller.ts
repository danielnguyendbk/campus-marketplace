import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthCheckData } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth(): Promise<HealthCheckData> {
    return this.healthService.check();
  }

  @Get('api/v1/health')
  async getHealthPrefixed(): Promise<HealthCheckData> {
    return this.healthService.check();
  }
}
