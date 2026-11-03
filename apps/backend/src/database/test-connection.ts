import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { getSslConfig } from '../config/database.config';

// Helper to load .env manually if dotenv is not imported
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

// Try loading root .env and backend .env
loadEnvFile(path.resolve(__dirname, '../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../.env'));

const EXPECTED_TABLES = [
  'users',
  'otp_verifications',
  'student_evidences',
  'categories',
  'user_preferences',
  'posts',
  'sell_details',
  'buy_request_details',
  'post_images',
  'conversations',
  'messages',
  'attachments',
  'reputation_events',
  'reports',
  'audit_logs',
  'phone_reveal_events',
  'notifications',
  'system_configs',
];

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();

  console.log('=======================================================');
  console.log('   CAMPUS MARKETPLACE - SUPABASE DATABASE TEST');
  console.log('=======================================================');

  if (!connectionString) {
    console.error('❌ LỖI: Chưa tìm thấy biến DATABASE_URL trong .env!');
    console.log('\nHướng dẫn:');
    console.log('1. Mở file `.env` ở thư mục gốc (hoặc apps/backend/.env).');
    console.log('2. Dán Connection String từ Supabase:');
    console.log('   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"');
    console.log('3. Chạy lại lệnh kiểm tra: pnpm --filter @campus/backend db:test\n');
    process.exit(1);
  }

  // Mask password for display
  const maskedUrl = connectionString.replace(/(:[^:@/]+)(@)/, ':****$2');
  console.log(`🔗 Đang kết nối tới: ${maskedUrl}`);

  const ssl = getSslConfig(connectionString);
  console.log(`🔒 TLS/SSL Verification: ${ssl ? (ssl.rejectUnauthorized ? 'ENFORCED (rejectUnauthorized: true)' : 'DISABLED (rejectUnauthorized: false)') : 'NONE'}`);
  const client = new Client({
    connectionString,
    ssl,
    connectionTimeoutMillis: 10000,
  });

  const startTime = Date.now();
  try {
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Kết nối thành công tới PostgreSQL trên Supabase! (Thời gian ping: ${connectTime}ms)\n`);

    // 1. Kiểm tra phiên bản PostgreSQL
    const versionRes = await client.query('SELECT version();');
    console.log(`📌 Phiên bản DB: ${versionRes.rows[0].version}\n`);

    // 2. Kiểm tra danh sách bảng trong schema public
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
    console.log(`📊 Tổng số bảng hiện có trong schema public: ${existingTables.size}`);

    console.log('\n--- Kiểm tra 18 bảng Baseline v1.2 ---');
    let matchedCount = 0;
    for (const table of EXPECTED_TABLES) {
      if (existingTables.has(table)) {
        matchedCount++;
        // Đếm số dòng
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}";`);
        const count = countRes.rows[0].count;
        console.log(`  ✅ [${matchedCount.toString().padStart(2, '0')}/18] Bảng "${table}": TỒN TẠI (Số bản ghi: ${count})`);
      } else {
        console.log(`  ❌ [ --/18] Bảng "${table}": CHƯA TỒN TẠI`);
      }
    }

    console.log('\n=======================================================');
    if (matchedCount === 18) {
      console.log('🎉 XÁC NHẬN: Toàn bộ 18/18 bảng của Campus Marketplace v1.2 đã sẵn sàng trên Supabase!');
    } else {
      console.log(`⚠️ Lưu ý: Phát hiện ${matchedCount}/18 bảng. Có thể cần chạy file database/baseline/schema_v1.2.sql nếu chưa khởi tạo đầy đủ.`);
    }
    console.log('=======================================================');
  } catch (err: unknown) {
    console.error('\n❌ KẾT NỐI THẤT BẠI:');
    if (err instanceof Error) {
      console.error(`Chi tiết lỗi: ${err.message}`);
    } else {
      console.error(String(err));
    }
    console.log('\nMột số nguyên nhân thường gặp:');
    console.log('- Mật khẩu chứa ký tự đặc biệt cần URL encode (ví dụ: #, @, $, %).');
    console.log('- Supabase paused/inactive project: Hãy kiểm tra Dashboard Supabase.');
    console.log('- IP restrictions hoặc IPv6: Khuyến nghị dùng connection string Pooler (cổng 6543 hoặc 5432).');
  } finally {
    await client.end();
  }
}

main();

