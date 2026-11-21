import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
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
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@ptithcm.edu.vn';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_SEED_NAME || 'Quản trị viên Hệ thống';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

  console.log('=======================================================');
  console.log('   CAMPUS MARKETPLACE - SEED ADMIN ACCOUNT');
  console.log('=======================================================');
  console.log(`👤 Admin Email:        ${adminEmail}`);
  console.log(`🏷️  Display Name:       ${adminName}`);
  console.log(`🔑 Default Password:   ${adminPassword}`);
  console.log('⏳ Hashing password with bcrypt...');

  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  const ssl = getSslConfig(connectionString);
  const client = new Client({ connectionString, ssl, connectionTimeoutMillis: 10000 });

  await client.connect();
  console.log('✅ Connected to PostgreSQL database');

  const upsertSql = `
    INSERT INTO "users" (
      "id",
      "school_email",
      "password_hash",
      "display_name",
      "role",
      "verification_status",
      "reputation_score"
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      'ADMIN',
      'APPROVED',
      5.0
    )
    ON CONFLICT ("school_email") DO UPDATE
    SET "role" = 'ADMIN',
        "verification_status" = 'APPROVED',
        "password_hash" = EXCLUDED."password_hash",
        "display_name" = EXCLUDED."display_name"
    RETURNING "id", "school_email", "role", "verification_status", "created_at";
  `;

  const result = await client.query(upsertSql, [adminEmail, passwordHash, adminName]);
  const user = result.rows[0];

  console.log('-------------------------------------------------------');
  console.log('🎉 ADMIN ACCOUNT SEEDED SUCCESSFULLY!');
  console.log(`🆔 ID:                  ${user.id}`);
  console.log(`📧 School Email:        ${user.school_email}`);
  console.log(`🛡️  Role:                ${user.role}`);
  console.log(`✅ Status:              ${user.verification_status}`);
  console.log('-------------------------------------------------------');
  console.log('💡 Sử dụng thông tin trên để đăng nhập qua API POST /api/v1/auth/login');

  await client.end();
}

main().catch((err) => {
  console.error('❌ Failed to seed admin account:', err);
  process.exit(1);
});

