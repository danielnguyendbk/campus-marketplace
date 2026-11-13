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
   * Creates a new student account in `users`.
   * `role` and `verification_status` rely on PostgreSQL column defaults ('USER', 'PENDING').
   */
  async createUser(
    params: {
      schoolEmail: string;
      passwordHash: string;
      displayName: string;
    },
    client?: PoolClient,
  ): Promise<AuthUser> {
    const sql = `
      INSERT INTO "users" ("school_email", "password_hash", "display_name")
      VALUES ($1, $2, $3)
      RETURNING "id", "display_name", "role", "verification_status";
    `;
    const res = await this.executeQuery<{
      id: string;
      display_name: string;
      role: UserRole;
      verification_status: VerificationStatus;
    }>(sql, [params.schoolEmail, params.passwordHash, params.displayName], client);

    const created = res.rows[0];
    return {
      id: created.id,
      displayName: created.display_name,
      role: created.role,
      verificationStatus: created.verification_status,
    };
  }
}
