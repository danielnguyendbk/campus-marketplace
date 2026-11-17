import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { VerificationStatus } from '../../auth/auth.types';
import { StudentEvidenceRow, SubmitEvidenceData } from '../verification.types';

@Injectable()
export class EvidenceRepository extends BaseRepository<StudentEvidenceRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'student_evidences');
  }

  async createEvidence(
    userId: string,
    cardImageRef: string,
    client?: PoolClient,
  ): Promise<StudentEvidenceRow> {
    const sql = `
      INSERT INTO "student_evidences" ("user_id", "card_image_ref", "submitted_at", "reason")
      VALUES ($1, $2, now(), NULL)
      RETURNING "id", "user_id", "card_image_ref", "submitted_at", "reviewed_by", "reviewed_at", "reason";
    `;
    const res = await this.executeQuery<StudentEvidenceRow>(sql, [userId, cardImageRef], client);
    return res.rows[0];
  }

  async getLatestByUserId(userId: string, client?: PoolClient): Promise<StudentEvidenceRow | null> {
    const sql = `
      SELECT "id", "user_id", "card_image_ref", "submitted_at", "reviewed_by", "reviewed_at", "reason"
      FROM "student_evidences"
      WHERE "user_id" = $1
      ORDER BY "submitted_at" DESC
      LIMIT 1;
    `;
    const res = await this.executeQuery<StudentEvidenceRow>(sql, [userId], client);
    return res.rows[0] ?? null;
  }

  async updateUserStudentInfo(
    userId: string,
    data: SubmitEvidenceData,
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      UPDATE "users"
      SET "school" = $1,
          "major" = $2,
          "class_name" = $3,
          "student_code" = $4,
          "cohort" = $5,
          "province" = $6,
          "verification_status" = 'PENDING',
          "updated_at" = now()
      WHERE "id" = $7;
    `;
    await this.executeQuery(
      sql,
      [
        data.school,
        data.major ?? null,
        data.className ?? null,
        data.studentCode,
        data.cohort ?? null,
        data.province ?? null,
        userId,
      ],
      client,
    );
  }

  async getUserVerificationStatus(
    userId: string,
    client?: PoolClient,
  ): Promise<VerificationStatus | null> {
    const sql = `
      SELECT "verification_status"
      FROM "users"
      WHERE "id" = $1
      LIMIT 1;
    `;
    const res = await this.executeQuery<{ verification_status: VerificationStatus }>(
      sql,
      [userId],
      client,
    );
    return res.rows[0]?.verification_status ?? null;
  }
}

