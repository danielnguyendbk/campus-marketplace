import { PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseSslOptions {
  rejectUnauthorized: boolean;
  ca?: string;
}

/**
 * Resolves the CA certificate from environment variables or known project paths.
 * Supports inline PEM (PGSSL_CA) or path to certificate file (PGSSL_CA_PATH).
 */
export function resolveCaCertificate(): string | undefined {
  if (process.env.PGSSL_CA && process.env.PGSSL_CA.trim().length > 0) {
    return process.env.PGSSL_CA.trim();
  }

  const candidatePaths: (string | undefined)[] = [
    process.env.PGSSL_CA_PATH,
    path.resolve(__dirname, '../../../../database/supabase-ca.crt'),
    path.resolve(__dirname, '../../../database/supabase-ca.crt'),
    path.resolve(__dirname, '../../database/supabase-ca.crt'),
    path.resolve(process.cwd(), 'database/supabase-ca.crt'),
    path.resolve(process.cwd(), '../../database/supabase-ca.crt'),
  ];

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      try {
        const cert = fs.readFileSync(candidate, 'utf-8').trim();
        if (cert.length > 0) {
          return cert;
        }
      } catch {
        // Continue checking fallback candidates
      }
    }
  }

  return undefined;
}

/**
 * Computes SSL configuration ensuring strict TLS verification for remote connections.
 * AUDIT-04 / Condition 5: Remote PostgreSQL MUST verify TLS certificates by default (rejectUnauthorized: true).
 */
export function getSslConfig(connectionString?: string): DatabaseSslOptions | undefined {
  const isExplicitlyDisabled = process.env.PGSSL === 'false';
  const isRemoteOrSupabase =
    Boolean(
      connectionString &&
        (connectionString.includes('supabase') ||
          (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'))),
    ) ||
    Boolean(
      process.env.PGHOST &&
        process.env.PGHOST !== 'localhost' &&
        process.env.PGHOST !== '127.0.0.1',
    );

  const shouldUseSsl = isRemoteOrSupabase || process.env.PGSSL === 'true';

  if (!shouldUseSsl || (isExplicitlyDisabled && !isRemoteOrSupabase)) {
    return undefined;
  }

  // Reject unauthorized certificates by default. Never default to false.
  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = resolveCaCertificate();

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
}

export const getDatabaseConfig = (): PoolConfig => {
  const connectionString = process.env.DATABASE_URL?.trim();
  const sslConfig = getSslConfig(connectionString);

  if (connectionString && connectionString !== '') {
    return {
      connectionString,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
    ssl: sslConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
};
