import { ConfigModule } from '@nestjs/config';
import { Client, Pool } from 'pg';
import * as path from 'path';
import { getSslConfig } from '../src/config/database.config';
import { PostgresService } from '../src/database/postgres.service';
import { OtpRepository } from '../src/modules/auth/repositories/otp.repository';
import { UserRepository } from '../src/modules/auth/repositories/user.repository';

// Mirrors AppModule so the same .env files are used as in production/dev.
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/backend/.env'),
  ],
});

const connectionString = process.env.DATABASE_URL?.trim();
const describeWithDatabase = connectionString ? describe : describe.skip;

const SCHEMA = 'cmp37_isolated_test';

const DDL = [
  `CREATE TYPE "otp_purpose" AS ENUM ('REGISTER');`,
  `CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');`,
  `CREATE TYPE "verification_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');`,
  `CREATE TABLE "users" (
     "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
     "school_email" varchar(255) UNIQUE NOT NULL,
     "password_hash" text NOT NULL,
     "display_name" varchar(255) NOT NULL,
     "role" user_role NOT NULL DEFAULT 'USER',
     "verification_status" verification_status NOT NULL DEFAULT 'PENDING',
     "deleted_at" timestamptz,
     "created_at" timestamptz NOT NULL DEFAULT (now()),
     "updated_at" timestamptz NOT NULL DEFAULT (now())
   );`,
  `CREATE TABLE "otp_verifications" (
     "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
     "email" varchar(255) NOT NULL,
     "code_hash" text NOT NULL,
     "purpose" otp_purpose NOT NULL DEFAULT 'REGISTER',
     "expires_at" timestamptz NOT NULL,
     "attempts" int NOT NULL DEFAULT 0,
     "verified_at" timestamptz,
     "created_at" timestamptz NOT NULL DEFAULT (now())
   );`,
];

describeWithDatabase(
  'CMP-37 — atomic OTP ticket concurrency on an isolated PostgreSQL schema',
  () => {
    jest.setTimeout(30_000);

    let pool: Pool;
    let admin: Client;
    let otpRepository: OtpRepository;
    let userRepository: UserRepository;
    let publicTableCount: number;

    const query = async <T extends Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<T[]> => {
      const res = await admin.query(sql, params);
      return res.rows as T[];
    };

    beforeAll(async () => {
      const ssl = getSslConfig(connectionString);
      pool = new Pool({
        connectionString,
        ssl,
        max: 5,
        options: `-c search_path=${SCHEMA}`,
      });
      admin = new Client({ connectionString, ssl });
      await admin.connect();
      await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
      await admin.query(`SET search_path TO "${SCHEMA}"`);
      for (const statement of DDL) {
        await admin.query(statement);
      }

      const publicTables = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS "total" FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      publicTableCount = publicTables[0].total;

      const dbStub = {
        query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      } as unknown as PostgresService;
      otpRepository = new OtpRepository(dbStub);
      userRepository = new UserRepository(dbStub);
    });

    afterAll(async () => {
      if (pool) {
        await pool.end();
      }
      if (admin) {
        await admin.query(`SET search_path TO public`);
        await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await admin.end();
      }
    });

    const seedOtp = async (
      email: string,
      options: { expiresInMs?: number; attempts?: number; verified?: boolean } = {},
    ): Promise<string> => {
      const row = await otpRepository.createOtp({
        email,
        codeHash: 'hash-not-a-secret',
        expiresAt: new Date(Date.now() + (options.expiresInMs ?? 600_000)),
      });
      if (options.attempts) {
        await query(`UPDATE "otp_verifications" SET "attempts" = $2 WHERE "id" = $1`, [
          row.id,
          options.attempts,
        ]);
      }
      if (options.verified) {
        const marked = await otpRepository.markVerified(row.id, 5, 600);
        expect(marked).toBe(true);
      }
      return row.id;
    };

    it('grants exactly one otpTicket when five verify-otp transitions run concurrently', async () => {
      const id = await seedOtp('race.verify@ptit.edu.vn');

      const results = await Promise.all(
        Array.from({ length: 5 }, () => otpRepository.markVerified(id, 5, 600)),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      const [row] = await query<{ verified: number; future: number }>(
        `SELECT COUNT(*) FILTER (WHERE "verified_at" IS NOT NULL)::int AS "verified",
                COUNT(*) FILTER (WHERE "expires_at" > now())::int AS "future"
         FROM "otp_verifications" WHERE "id" = $1`,
        [id],
      );
      expect(row).toEqual({ verified: 1, future: 1 });
    });

    it('consumes a verified ticket exactly once when five register requests race', async () => {
      const id = await seedOtp('race.register@ptit.edu.vn', { verified: true });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => otpRepository.consumeVerifiedTicket(id)),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      const [row] = await query<{ active: number }>(
        `SELECT COUNT(*) FILTER (WHERE "expires_at" > now())::int AS "active"
         FROM "otp_verifications" WHERE "id" = $1`,
        [id],
      );
      expect(row.active).toBe(0);
    });

    it('rejects replay of an already consumed ticket', async () => {
      const id = await seedOtp('replay@ptit.edu.vn', { verified: true });

      await expect(otpRepository.consumeVerifiedTicket(id)).resolves.toBe(true);
      await expect(otpRepository.consumeVerifiedTicket(id)).resolves.toBe(false);
    });

    it('revokes an unconsumed verified ticket when a newer OTP is requested', async () => {
      const email = 'revoked@ptit.edu.vn';
      const id = await seedOtp(email, { verified: true });

      await otpRepository.expireActiveByEmail(email);

      await expect(otpRepository.consumeVerifiedTicket(id)).resolves.toBe(false);
      const [row] = await query<{ active: number }>(
        `SELECT COUNT(*) FILTER (WHERE "expires_at" > now())::int AS "active"
         FROM "otp_verifications" WHERE "email" = $1`,
        [email],
      );
      expect(row.active).toBe(0);
    });

    it('enforces the expires_at and attempts boundaries in SQL', async () => {
      const expiredId = await seedOtp('expired@ptit.edu.vn', { expiresInMs: -1 });
      await expect(otpRepository.markVerified(expiredId, 5, 600)).resolves.toBe(false);
      await expect(otpRepository.incrementAttempts(expiredId, 5)).resolves.toBeNull();

      const lockedId = await seedOtp('locked@ptit.edu.vn', { attempts: 5 });
      await expect(otpRepository.markVerified(lockedId, 5, 600)).resolves.toBe(false);

      const boundaryId = await seedOtp('boundary@ptit.edu.vn', { attempts: 4 });
      await expect(otpRepository.markVerified(boundaryId, 5, 600)).resolves.toBe(true);
    });

    it('creates exactly one user when five concurrent registrations insert the same email', async () => {
      const email = 'race.user@ptit.edu.vn';
      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          userRepository.createUser({
            schoolEmail: email,
            passwordHash: 'bcrypt-hash-not-a-secret',
            displayName: 'Sinh viên CMP37',
          }),
        ),
      );

      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = attempts.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(failed).toHaveLength(4);
      for (const failure of failed) {
        expect((failure.reason as { code?: string }).code).toBe('23505');
      }

      const [row] = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS "total" FROM "users" WHERE "school_email" = $1`,
        [email],
      );
      expect(row.total).toBe(1);
    });

    it('leaves the isolated schema fully removed after the run', async () => {
      await admin.query(`SET search_path TO public`);
      await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      const rows = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS "total" FROM information_schema.schemata WHERE schema_name = $1`,
        [SCHEMA],
      );
      expect(rows[0].total).toBe(0);

      // The public schema is untouched by the isolated run.
      const publicTables = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS "total" FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      expect(publicTables[0].total).toBe(publicTableCount);
    });
  },
);
