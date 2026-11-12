import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { AuthUser, UserRole, VerificationStatus } from '../auth.types';

export interface UserRow {
  id: string;
  school_email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  deleted_at?: Date | null;
}

@Injectable()
export class UserRepository extends BaseRepository<UserRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'users');
  }

  async existsByEmail(email: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      SELECT 1 AS "exists"
      FROM "users"
      WHERE "school_email" = $1
      LIMIT 1;
    `;
    const res = await this.executeQuery<{ exists: number }>(sql, [email], client);
    return res.rows.length > 0;
  }

  async findActiveByEmail(email: string, client?: PoolClient): Promise<UserRow | null> {
    const sql = `
      SELECT "id", "school_email", "password_hash", "display_name", "role", "verification_status"
      FROM "users"
      WHERE "school_email" = $1
        AND "deleted_at" IS NULL
      LIMIT 1;
    `;
    const res = await this.executeQuery<UserRow>(sql, [email], client);
    return res.rows[0] ?? null;
  }

  /**
   * Creates a new student account inside an explicit database transaction.
   *
   * NOTE on reversed FK (database/baseline/schema_v1.2.sql line 330):
   *   ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "user_preferences" ("user_id")
   * Because `users.id` currently references `user_preferences.user_id`, the default
   * `user_preferences` row MUST be inserted first using a generated UUID, and then
   * `users` is inserted with that same `id`. Both statements run inside `withTransaction`
   * so any failure rolls back both tables cleanly.
   *
   * `role` and `verification_status` rely on PostgreSQL column defaults ('USER', 'PENDING').
   */
  async createWithPreferences(params: {
    schoolEmail: string;
    passwordHash: string;
    displayName: string;
  }): Promise<AuthUser> {
    return this.postgresService.withTransaction(async (client: PoolClient) => {
      const prefSql = `
        INSERT INTO "user_preferences" ("user_id")
        VALUES (gen_random_uuid())
        RETURNING "user_id";
      `;
      const prefRes = await this.executeQuery<{ user_id: string }>(prefSql, [], client);
      const userId = prefRes.rows[0].user_id;

      const userSql = `
        INSERT INTO "users" ("id", "school_email", "password_hash", "display_name")
        VALUES ($1, $2, $3, $4)
        RETURNING "id", "display_name", "role", "verification_status";
      `;
      const userRes = await this.executeQuery<{
        id: string;
        display_name: string;
        role: UserRole;
        verification_status: VerificationStatus;
      }>(
        userSql,
        [userId, params.schoolEmail, params.passwordHash, params.displayName],
        client,
      );

      const created = userRes.rows[0];
      return {
        id: created.id,
        displayName: created.display_name,
        role: created.role,
        verificationStatus: created.verification_status,
      };
    });
  }
}

