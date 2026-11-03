import { getSslConfig, getDatabaseConfig, resolveCaCertificate } from './database.config';
import * as fs from 'fs';

describe('DatabaseConfig TLS & SSL verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.PGSSL;
    delete process.env.PGSSL_REJECT_UNAUTHORIZED;
    delete process.env.PGSSL_CA;
    delete process.env.PGSSL_CA_PATH;
    delete process.env.PGHOST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should disable SSL for localhost connections when PGSSL is not set', () => {
    const ssl = getSslConfig('postgresql://user:pass@localhost:5432/mydb');
    expect(ssl).toBeUndefined();
  });

  it('should enable SSL and enforce rejectUnauthorized: true by default for Supabase / remote connections', () => {
    const ssl = getSslConfig('postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    expect(ssl).toBeDefined();
    expect(ssl?.rejectUnauthorized).toBe(true);
  });

  it('should enforce rejectUnauthorized: true by default when PGSSL=true', () => {
    process.env.PGSSL = 'true';
    const ssl = getSslConfig('postgresql://user:pass@localhost:5432/mydb');
    expect(ssl).toBeDefined();
    expect(ssl?.rejectUnauthorized).toBe(true);
  });

  it('should enforce rejectUnauthorized: true for remote / Supabase even if PGSSL_REJECT_UNAUTHORIZED=false', () => {
    process.env.PGSSL_REJECT_UNAUTHORIZED = 'false';
    const ssl = getSslConfig('postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    expect(ssl).toBeDefined();
    // Must remain true to forbid disabling certificate verification on remote PostgreSQL
    expect(ssl?.rejectUnauthorized).toBe(true);
  });

  it('should allow setting rejectUnauthorized: false only for local connections with PGSSL=true', () => {
    process.env.PGSSL = 'true';
    process.env.PGSSL_REJECT_UNAUTHORIZED = 'false';
    const ssl = getSslConfig('postgresql://user:pass@localhost:5432/mydb');
    expect(ssl).toBeDefined();
    expect(ssl?.rejectUnauthorized).toBe(false);
  });

  it('should automatically locate and load the repository root CA cert database/supabase-ca.crt', () => {
    const ca = resolveCaCertificate();
    expect(ca).toBeDefined();
    expect(ca).toContain('-----BEGIN CERTIFICATE-----');
    expect(ca).toContain('-----END CERTIFICATE-----');
    // Base64 fragment for Supabase Root CA 2021
    expect(ca).toContain('U3VwYWJh');
  });

  it('should support inline CA certificate via PGSSL_CA', () => {
    process.env.PGSSL_CA = '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----';
    const ssl = getSslConfig('postgresql://user:pass@remotehost.com:5432/postgres');
    expect(ssl).toBeDefined();
    expect(ssl?.rejectUnauthorized).toBe(true);
    expect(ssl?.ca).toBe('-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----');
  });

  it('should support CA certificate path via PGSSL_CA_PATH', () => {
    const tempCertPath = 'database/supabase-ca.crt';
    if (fs.existsSync(tempCertPath)) {
      process.env.PGSSL_CA_PATH = tempCertPath;
      const ca = resolveCaCertificate();
      expect(ca).toBeDefined();
      expect(ca).toContain('BEGIN CERTIFICATE');
    }
  });

  it('should construct PoolConfig with connectionString and ssl config', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@supabase.com:5432/postgres';
    const config = getDatabaseConfig();
    expect(config.connectionString).toBe('postgresql://user:pass@supabase.com:5432/postgres');
    expect(config.ssl).toBeDefined();
    expect((config.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized).toBe(true);
  });
});

