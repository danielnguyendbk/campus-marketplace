import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { getSslConfig } from '../config/database.config';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.resolve(__dirname, '../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../.env'));

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  const ssl = getSslConfig(connectionString);
  const client = new Client({ connectionString, ssl, connectionTimeoutMillis: 10000 });

  await client.connect();
  console.log('✅ Connected to PostgreSQL for migrations');

  // Create migrations table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL UNIQUE,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRes = await client.query<{ name: string }>('SELECT name FROM "_migrations" ORDER BY id ASC;');
  const appliedSet = new Set(appliedRes.rows.map((r) => r.name));

  const migrationsDir = path.resolve(__dirname, '../../../../database/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s) in ${migrationsDir}`);

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏩ [ALREADY APPLIED] ${file}`);
      continue;
    }

    console.log(`  🚀 [APPLYING] ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    // Execute migration in transaction
    await client.query(sql);
    await client.query('INSERT INTO "_migrations" (name) VALUES ($1);', [file]);
    console.log(`  ✅ [SUCCESS] ${file} applied successfully`);
  }

  console.log('🎉 All migrations up to date.');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

