import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { UserRole, VerificationStatus } from '../../auth/auth.types';

export interface RawProfileRow {
  id: string;
  school_email: string;
  display_name: string;
  phone_number: string | null;
  role: UserRole;
  verification_status: VerificationStatus;
  school: string | null;
  major: string | null;
  class_name: string | null;
  student_code: string | null;
  cohort: string | null;
  province: string | null;
  reputation_score: number | string;
  created_at: Date | string;
}

export interface RawPreferenceRow {
  user_id: string;
  favorite_category_ids: string[];
  interest_keywords: string[];
  updated_at: Date | string;
}

@Injectable()
export class UserProfileRepository extends BaseRepository<RawProfileRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'users');
  }

  async findProfileById(userId: string): Promise<RawProfileRow | null> {
    const sql = `
      SELECT
        u."id",
        u."school_email",
        u."display_name",
        u."phone_number",
        u."role",
        u."verification_status",
        u."school",
        u."major",
        u."class_name",
        u."student_code",
        u."cohort",
        u."province",
        u."reputation_score",
        u."created_at"
      FROM "users" u
      WHERE u."id" = $1
        AND u."deleted_at" IS NULL
      LIMIT 1;
    `;
    const res = await this.executeQuery<RawProfileRow>(sql, [userId]);
    return res.rows[0] ?? null;
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      phoneNumber?: string | null;
      province?: string;
    },
  ): Promise<RawProfileRow | null> {
    const setClauses: string[] = ['"updated_at" = clock_timestamp()'];
    const values: unknown[] = [userId];

    if (data.displayName !== undefined) {
      values.push(data.displayName);
      setClauses.push(`"display_name" = $${values.length}`);
    }

    if (data.phoneNumber !== undefined) {
      values.push(data.phoneNumber);
      setClauses.push(`"phone_number" = $${values.length}`);
    }

    if (data.province !== undefined) {
      values.push(data.province);
      setClauses.push(`"province" = $${values.length}`);
    }

    const sql = `
      UPDATE "users"
      SET ${setClauses.join(', ')}
      WHERE "id" = $1
        AND "deleted_at" IS NULL
      RETURNING
        "id",
        "school_email",
        "display_name",
        "phone_number",
        "role",
        "verification_status",
        "school",
        "major",
        "class_name",
        "student_code",
        "cohort",
        "province",
        "reputation_score",
        "created_at";
    `;

    const res = await this.executeQuery<RawProfileRow>(sql, values);
    return res.rows[0] ?? null;
  }

  async findPreferences(userId: string): Promise<RawPreferenceRow | null> {
    const sql = `
      SELECT "user_id", "favorite_category_ids", "interest_keywords", "updated_at"
      FROM "user_preferences"
      WHERE "user_id" = $1
      LIMIT 1;
    `;
    const res = await this.executeQuery<RawPreferenceRow>(sql, [userId]);
    return res.rows[0] ?? null;
  }

  async upsertPreferences(
    userId: string,
    favoriteCategoryIds: string[],
    interestKeywords: string[],
  ): Promise<RawPreferenceRow> {
    const sql = `
      INSERT INTO "user_preferences" ("user_id", "favorite_category_ids", "interest_keywords", "updated_at")
      VALUES ($1, $2, $3, clock_timestamp())
      ON CONFLICT ("user_id") DO UPDATE
      SET "favorite_category_ids" = EXCLUDED."favorite_category_ids",
          "interest_keywords" = EXCLUDED."interest_keywords",
          "updated_at" = clock_timestamp()
      RETURNING "user_id", "favorite_category_ids", "interest_keywords", "updated_at";
    `;
    const res = await this.executeQuery<RawPreferenceRow>(sql, [
      userId,
      favoriteCategoryIds,
      interestKeywords,
    ]);
    return res.rows[0];
  }
}

