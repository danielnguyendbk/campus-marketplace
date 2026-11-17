import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { VerificationStatus } from '../../auth/auth.types';
import {
  AdminVerificationDetailRow,
  StudentEvidenceRow,
  SubmitEvidenceData,
} from '../verification.types';

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

  async listVerifications(
    params: { page: number; limit: number; status?: VerificationStatus },
    client?: PoolClient,
  ): Promise<AdminVerificationDetailRow[]> {
    const offset = (params.page - 1) * params.limit;
    const sql = `
      SELECT 
        e.id, 
        e.user_id, 
        e.card_image_ref, 
        e.submitted_at, 
        e.reviewed_by, 
        e.reviewed_at, 
        e.reason, 
        u.school_email, 
        u.display_name, 
        u.school, 
        u.student_code, 
        u.verification_status
      FROM "student_evidences" e
      JOIN "users" u ON e.user_id = u.id
      WHERE ($1::varchar IS NULL OR u.verification_status = $1::verification_status)
      ORDER BY e.submitted_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const res = await this.executeQuery<AdminVerificationDetailRow>(
      sql,
      [params.status ?? null, params.limit, offset],
      client,
    );
    return res.rows;
  }

  async countVerifications(status?: VerificationStatus, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM "student_evidences" e
      JOIN "users" u ON e.user_id = u.id
      WHERE ($1::varchar IS NULL OR u.verification_status = $1::verification_status);
    `;
    const res = await this.executeQuery<{ total: number }>(sql, [status ?? null], client);
    return res.rows[0]?.total ?? 0;
  }

  async getVerificationDetailById(
    verificationId: string,
    client?: PoolClient,
  ): Promise<AdminVerificationDetailRow | null> {
    const sql = `
      SELECT 
        e.id, 
        e.user_id, 
        e.card_image_ref, 
        e.submitted_at, 
        e.reviewed_by, 
        e.reviewed_at, 
        e.reason, 
        u.school_email, 
        u.display_name, 
        u.school, 
        u.student_code, 
        u.verification_status
      FROM "student_evidences" e
      JOIN "users" u ON e.user_id = u.id
      WHERE e.id = $1
      LIMIT 1;
    `;
    const res = await this.executeQuery<AdminVerificationDetailRow>(sql, [verificationId], client);
    return res.rows[0] ?? null;
  }

  async updateReviewStatus(
    params: {
      verificationId: string;
      userId: string;
      adminId: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    },
    client?: PoolClient,
  ): Promise<void> {
    const updateEvidenceSql = `
      UPDATE "student_evidences"
      SET "reviewed_by" = $1,
          "reviewed_at" = now(),
          "reason" = $2
      WHERE "id" = $3;
    `;
    await this.executeQuery(
      updateEvidenceSql,
      [params.adminId, params.decision === 'REJECTED' ? (params.reason ?? null) : null, params.verificationId],
      client,
    );

    const updateUserSql = `
      UPDATE "users"
      SET "verification_status" = $1,
          "updated_at" = now()
      WHERE "id" = $2;
    `;
    await this.executeQuery(updateUserSql, [params.decision, params.userId], client);
  }

  async recordAuditLog(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload?: Record<string, unknown>,
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "payload", "created_at")
      VALUES ($1, $2, $3, $4, $5::jsonb, now());
    `;
    await this.executeQuery(
      sql,
      [actorId, action, targetType, targetId, payload ? JSON.stringify(payload) : null],
      client,
    );
  }

  async createNotification(
    userId: string,
    title: string,
    content: string,
    type: string,
    refId?: string,
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      INSERT INTO "notifications" ("user_id", "title", "content", "type", "ref_id", "created_at")
      VALUES ($1, $2, $3, $4, $5, now());
    `;
    await this.executeQuery(sql, [userId, title, content, type, refId ?? null], client);
  }
}
