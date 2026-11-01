import { PoolConfig } from 'pg';

export const getDatabaseConfig = (): PoolConfig => {
  const connectionString = process.env.DATABASE_URL?.trim();

  // If explicit PGSSL is set to false, disable SSL; otherwise default to SSL for Supabase or remote hosts
  const isSslDisabled = process.env.PGSSL === 'false';
  const isRemoteOrSupabase =
    Boolean(connectionString && (connectionString.includes('supabase') || !connectionString.includes('localhost'))) ||
    Boolean(process.env.PGHOST && process.env.PGHOST !== 'localhost' && process.env.PGHOST !== '127.0.0.1');

  const shouldUseSsl = !isSslDisabled && (process.env.PGSSL === 'true' || isRemoteOrSupabase);

  const sslConfig = shouldUseSsl ? { rejectUnauthorized: false } : undefined;

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
