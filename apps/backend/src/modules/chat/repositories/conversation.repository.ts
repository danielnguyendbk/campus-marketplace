import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { VerificationStatus } from '../../auth/auth.types';
import { PostStatus, PostType } from '../../posts/posts.types';
import { ConversationStatus, UserSummaryDto } from '../chat.types';

export interface ConversationRow {
  id: string;
  post_id: string;
  member_low_id: string;
  member_high_id: string;
  status: ConversationStatus;
  last_message_at: Date | string | null;
  created_at: Date | string;
}

export interface PostChatInfoRow {
  id: string;
  seller_id: string;
  post_type: PostType;
  status: PostStatus;
  seller_verification_status: VerificationStatus;
}

export interface ConversationListRow extends ConversationRow {
  post_status: PostStatus;
  post_type: PostType;
  low_id: string;
  low_display_name: string;
  low_verification_status: VerificationStatus;
  low_reputation_score: string | number;
  low_province: string | null;
  high_id: string;
  high_display_name: string;
  high_verification_status: VerificationStatus;
  high_reputation_score: string | number;
  high_province: string | null;
}

@Injectable()
export class ConversationRepository extends BaseRepository<ConversationRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'conversations');
  }

  async findPostForConversation(postId: string): Promise<PostChatInfoRow | null> {
    const res = await this.executeQuery<PostChatInfoRow>(
      `SELECT
         p."id",
         p."owner_id" AS "seller_id",
         p."post_type",
         p."status",
         u."verification_status" AS "seller_verification_status"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       WHERE p."id" = $1
         AND p."deleted_at" IS NULL
         AND u."deleted_at" IS NULL
       LIMIT 1;`,
      [postId],
    );
    return res.rows[0] ?? null;
  }

  async upsertConversation(
    postId: string,
    memberLowId: string,
    memberHighId: string,
  ): Promise<ConversationRow> {
    const res = await this.executeQuery<ConversationRow>(
      `INSERT INTO "conversations" ("post_id", "member_low_id", "member_high_id", "status", "created_at")
       VALUES ($1, $2, $3, 'OPEN', clock_timestamp())
       ON CONFLICT ("post_id", "member_low_id", "member_high_id")
       DO UPDATE SET "post_id" = "conversations"."post_id"
       RETURNING "id", "post_id", "member_low_id", "member_high_id", "status", "last_message_at", "created_at";`,
      [postId, memberLowId, memberHighId],
    );
    return res.rows[0];
  }

  async getUsersSummary(userIds: string[]): Promise<UserSummaryDto[]> {
    if (userIds.length === 0) return [];
    const res = await this.executeQuery<{
      id: string;
      display_name: string;
      verification_status: VerificationStatus;
      reputation_score: string | number;
      province: string | null;
    }>(
      `SELECT
         u."id",
         u."display_name",
         u."verification_status",
         u."reputation_score",
         u."province"
       FROM "users" u
       WHERE u."id" = ANY($1::uuid[])
         AND u."deleted_at" IS NULL;`,
      [userIds],
    );

    return res.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      verificationStatus: r.verification_status,
      reputationScore: Number(r.reputation_score),
      province: r.province ?? undefined,
    }));
  }

  async findConversationsByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: ConversationListRow[]; total: number }> {
    const offset = (page - 1) * limit;

    const countRes = await this.executeQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "conversations" c
       INNER JOIN "posts" p ON p."id" = c."post_id"
       WHERE (c."member_low_id" = $1 OR c."member_high_id" = $1)
         AND p."deleted_at" IS NULL;`,
      [userId],
    );
    const total = countRes.rows[0]?.total ?? 0;

    const rowsRes = await this.executeQuery<ConversationListRow>(
      `SELECT
         c."id",
         c."post_id",
         c."member_low_id",
         c."member_high_id",
         c."status",
         c."last_message_at",
         c."created_at",
         p."status" AS "post_status",
         p."post_type",
         u_low."id" AS "low_id",
         u_low."display_name" AS "low_display_name",
         u_low."verification_status" AS "low_verification_status",
         u_low."reputation_score" AS "low_reputation_score",
         u_low."province" AS "low_province",
         u_high."id" AS "high_id",
         u_high."display_name" AS "high_display_name",
         u_high."verification_status" AS "high_verification_status",
         u_high."reputation_score" AS "high_reputation_score",
         u_high."province" AS "high_province"
       FROM "conversations" c
       INNER JOIN "posts" p ON p."id" = c."post_id"
       INNER JOIN "users" u_low ON u_low."id" = c."member_low_id"
       INNER JOIN "users" u_high ON u_high."id" = c."member_high_id"
       WHERE (c."member_low_id" = $1 OR c."member_high_id" = $1)
         AND p."deleted_at" IS NULL
         AND u_low."deleted_at" IS NULL
         AND u_high."deleted_at" IS NULL
       ORDER BY c."last_message_at" DESC NULLS LAST, c."created_at" DESC
       LIMIT $2 OFFSET $3;`,
      [userId, limit, offset],
    );

    return { rows: rowsRes.rows, total };
  }
}
