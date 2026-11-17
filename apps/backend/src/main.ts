import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { getAppConfig } from './config/env.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = getAppConfig();

  // Serve locally uploaded post images in dev/demo mode
  app.useStaticAssets(path.resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Enable CORS
  app.enableCors({
    origin: config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Global API Prefix (/api/v1) with explicit exclusions for direct health probe routes
  app.setGlobalPrefix(config.apiPrefix.replace(/^\//, ''), {
    exclude: ['health', 'api/v1/health'],
  });

  // Global Validation, Interceptors & Filters
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable Graceful Shutdown hooks
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`=======================================================`);
  logger.log(` Campus Marketplace Backend API is running!`);
  logger.log(` Environment: ${config.nodeEnv}`);
  logger.log(` Listening on: http://localhost:${config.port}`);
  logger.log(` API Base Prefix: http://localhost:${config.port}${config.apiPrefix}`);
  logger.log(` Health Check: http://localhost:${config.port}/health`);
  logger.log(`=======================================================`);
}

bootstrap();
