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
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const ssl = getSslConfig(connectionString);
  const client = new Client({ connectionString, ssl, connectionTimeoutMillis: 10000 });

  await client.connect();

  console.log('=== SOFT-DELETE COLUMNS (deleted_at) ===');
  const delRes = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name IN ('posts', 'users') 
      AND column_name = 'deleted_at'
    ORDER BY table_name;
  `);
  console.log(delRes.rows);

  console.log('\n=== PG_CONSTRAINT AUDIT (CHECK, UNIQUE, FOREIGN KEY) ===');
  const res = await client.query(`
    SELECT 
      c.contype, 
      c.conrelid::regclass::text as table_name, 
      c.conname, 
      pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
    ORDER BY c.contype, table_name, c.conname;
  `);

  const typeMap: Record<string, string> = {
    c: 'CHECK',
    f: 'FOREIGN KEY',
    p: 'PRIMARY KEY',
    u: 'UNIQUE',
    t: 'TRIGGER',
    x: 'EXCLUSION'
  };

  for (const r of res.rows) {
    const typeLabel = typeMap[r.contype] || r.contype;
    console.log(`[${typeLabel}] ${r.table_name}.${r.conname}: ${r.definition}`);
  }

  console.log('\n=== INDEX AUDIT (PG_INDEXES) ===');
  const idxRes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  for (const r of idxRes.rows) {
    console.log(`[INDEX] ${r.tablename}.${r.indexname}: ${r.indexdef}`);
  }

  console.log('\n=== MIGRATIONS STATUS ===');
  // Check if a migrations tracking table exists
  const migTableRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%migration%';
  `);
  console.log('Migration tracking tables:', migTableRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
