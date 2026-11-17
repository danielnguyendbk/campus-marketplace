import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConfig } from '../config/database.config';
import { sanitizeLogMessage } from '../common/filters/http-exception.filter';

export type DbHealthStatus = 'connected' | 'disconnected' | 'not_configured';

export interface DbStatusInfo {
  status: DbHealthStatus;
  latencyMs?: number;
  message?: string;
}

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;
  private isConfigured = false;

  async onModuleInit() {
    const config = getDatabaseConfig();
    const hasConnectionString = Boolean(process.env.DATABASE_URL?.trim());
    const hasExplicitCredentials = Boolean(process.env.PGHOST && process.env.PGPASSWORD);

    if (!hasConnectionString && !hasExplicitCredentials) {
      this.logger.warn(
        'PostgreSQL credentials not provided in environment. Database pool will operate in unconfigured mode for local development/health-check.',
      );
      this.isConfigured = false;
      return;
    }

    try {
      this.pool = new Pool(config);
      this.isConfigured = true;

      // Handle pool errors gracefully to prevent crashing the server
      this.pool.on('error', (err) => {
        this.logger.error(
          `Unexpected error on idle PostgreSQL client: ${sanitizeLogMessage(err.message)}`,
        );
      });

      this.logger.log('PostgreSQL pool initialized successfully.');
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `PostgreSQL pool could not be initialized: ${sanitizeLogMessage(rawError)}`,
      );
      this.pool = null;
      this.isConfigured = false;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      try {
        await this.pool.end();
        this.logger.log('PostgreSQL connection pool closed cleanly.');
      } catch (err) {
        this.logger.error('Error closing PostgreSQL connection pool:', err);
      }
    }
  }

  /**
   * Health ping to check database connectivity without throwing unhandled exceptions.
   */
  async checkHealth(): Promise<DbStatusInfo> {
    if (!this.pool || !this.isConfigured) {
      return {
        status: 'not_configured',
        message: 'No DATABASE_URL or PostgreSQL credentials supplied in environment',
      };
    }

    const start = Date.now();
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1 AS health');
        const latencyMs = Date.now() - start;
        return {
          status: 'connected',
          latencyMs,
          message: 'PostgreSQL connection healthy',
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `PostgreSQL health check probe failed: ${sanitizeLogMessage(rawError)}`,
      );
      return {
        status: 'disconnected',
        message: 'Database connection unavailable',
      };
    }
  }

  /**
   * Executes a parameterized query using the pool.
   */
  async query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error(
        'Database connection pool is not configured. Please supply valid PostgreSQL credentials.',
      );
    }
    return this.pool.query<T>(text, params);
  }

  /**
   * Runs a unit of work inside an explicit transaction.
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) {
      throw new Error(
        'Database connection pool is not configured. Please supply valid PostgreSQL credentials.',
      );
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): Pool | null {
    return this.pool;
  }
}
