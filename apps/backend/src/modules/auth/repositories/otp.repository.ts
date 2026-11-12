import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';

export interface OtpVerificationRow {
  id: string;
  email: string;
  code_hash: string;
  purpose: 'REGISTER';
  expires_at: Date;
  attempts: number;
  verified_at: Date | null;
  created_at: Date;
}

export interface OtpSendStats {
  lastHourCount: number;
  lastSentAt: Date | null;
}

@Injectable()
export class OtpRepository extends BaseRepository<OtpVerificationRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'otp_verifications');
  }

  async getSendStats(email: string, client?: PoolClient): Promise<OtpSendStats> {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE "created_at" > now() - interval '1 hour')::int AS "lastHourCount",
        MAX("created_at") AS "lastSentAt"
      FROM "otp_verifications"
      WHERE "email" = $1 AND "purpose" = 'REGISTER';
    `;
    const res = await this.executeQuery<{
      lastHourCount: number;
      lastSentAt: Date | null;
    }>(sql, [email], client);
    const row = res.rows[0];
    return {
      lastHourCount: row?.lastHourCount ?? 0,
      lastSentAt: row?.lastSentAt ? new Date(row.lastSentAt) : null,
    };
  }

  async expireActiveByEmail(email: string, client?: PoolClient): Promise<void> {
    const sql = `
      UPDATE "otp_verifications"
      SET "expires_at" = now()
      WHERE "email" = $1
        AND "purpose" = 'REGISTER'
        AND "verified_at" IS NULL
        AND "expires_at" > now();
    `;
    await this.executeQuery(sql, [email], client);
  }

  async createOtp(
    params: { email: string; codeHash: string; expiresAt: Date },
    client?: PoolClient,
  ): Promise<OtpVerificationRow> {
    const sql = `
      INSERT INTO "otp_verifications" ("email", "code_hash", "purpose", "expires_at")
      VALUES ($1, $2, 'REGISTER', $3)
      RETURNING "id", "email", "code_hash", "purpose", "expires_at", "attempts", "verified_at", "created_at";
    `;
    const res = await this.executeQuery<OtpVerificationRow>(
      sql,
      [params.email, params.codeHash, params.expiresAt],
      client,
    );
    return res.rows[0];
  }

  async expireById(id: string, client?: PoolClient): Promise<void> {
    const sql = `
      UPDATE "otp_verifications"
      SET "expires_at" = now()
      WHERE "id" = $1;
    `;
    await this.executeQuery(sql, [id], client);
  }

  async findLatestActiveByEmail(
    email: string,
    client?: PoolClient,
  ): Promise<OtpVerificationRow | null> {
    const sql = `
      SELECT "id", "email", "code_hash", "purpose", "expires_at", "attempts", "verified_at", "created_at"
      FROM "otp_verifications"
      WHERE "email" = $1
        AND "purpose" = 'REGISTER'
        AND "verified_at" IS NULL
        AND "expires_at" > now()
      ORDER BY "created_at" DESC
      LIMIT 1;
    `;
    const res = await this.executeQuery<OtpVerificationRow>(sql, [email], client);
    return res.rows[0] ?? null;
  }

  /**
   * Atomically increments `attempts` only while below `maxAttempts`.
   * Returns the updated attempt count, or null if the limit was already reached.
   */
  async incrementAttempts(
    id: string,
    maxAttempts: number,
    client?: PoolClient,
  ): Promise<number | null> {
    const sql = `
      UPDATE "otp_verifications"
      SET "attempts" = "attempts" + 1
      WHERE "id" = $1
        AND "verified_at" IS NULL
        AND "attempts" < $2
      RETURNING "attempts";
    `;
    const res = await this.executeQuery<{ attempts: number }>(
      sql,
      [id, maxAttempts],
      client,
    );
    return res.rows[0]?.attempts ?? null;
  }

  async markVerified(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      UPDATE "otp_verifications"
      SET "verified_at" = now()
      WHERE "id" = $1 AND "verified_at" IS NULL
      RETURNING "id";
    `;
    const res = await this.executeQuery<{ id: string }>(sql, [id], client);
    return (res.rowCount ?? res.rows.length) > 0;
  }

  async findById(id: string, client?: PoolClient): Promise<OtpVerificationRow | null> {
    const sql = `
      SELECT "id", "email", "code_hash", "purpose", "expires_at", "attempts", "verified_at", "created_at"
      FROM "otp_verifications"
      WHERE "id" = $1
      LIMIT 1;
    `;
    const res = await this.executeQuery<OtpVerificationRow>(sql, [id], client);
    return res.rows[0] ?? null;
  }
}

