import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { PostStatus, PostType } from '../../posts/posts.types';
import { PersonalizationSignals } from '../feed.types';

export interface PendingFeedRow {
  id: string;
  title: string;
  post_type: PostType;
  created_at: Date | string;
  thumbnail_storage_key: string | null;
}

export interface ApprovedFeedRow {
  id: string;
  post_type: PostType;
  title: string;
  category_id: string;
  province: string;
  status: PostStatus;
  created_at: Date | string;
  price: string | number | null;
  budget_min: string | number | null;
  budget_max: string | number | null;
  thumbnail_storage_key: string | null;
  matched_fav_category?: boolean;
  matched_keyword?: boolean;
  matched_activity_category?: boolean;
  matched_province?: boolean;
  relevance_score?: number;
}

const ELIGIBLE_ACTIVE_POST_WHERE = `
  p."status" = 'ACTIVE'
  AND p."deleted_at" IS NULL
  AND u."deleted_at" IS NULL
  AND u."verification_status" = 'APPROVED'
`;

const THUMBNAIL_LATERAL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT pi."storage_key"
    FROM "post_images" pi
    WHERE pi."post_id" = p."id"
    ORDER BY pi."sort_order" ASC, pi."id" ASC
    LIMIT 1
  ) img ON true
`;

@Injectable()
export class FeedRepository extends BaseRepository<ApprovedFeedRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'posts');
  }

  /**
   * Collects explicit user preferences (`user_preferences`) and distinct categories
   * from the user's marketplace interactions (`posts`, `conversations`, `phone_reveal_events`).
   */
  async getPersonalizationSignals(userId: string): Promise<PersonalizationSignals> {
    const prefRes = await this.executeQuery<{
      favorite_category_ids: string[] | null;
      interest_keywords: string[] | null;
    }>(
      `SELECT "favorite_category_ids", "interest_keywords"
       FROM "user_preferences"
       WHERE "user_id" = $1
       LIMIT 1;`,
      [userId],
    );

    const activityRes = await this.executeQuery<{ category_id: string }>(
      `SELECT DISTINCT "category_id"
       FROM (
         SELECT p."category_id"
         FROM "posts" p
         WHERE p."owner_id" = $1 AND p."deleted_at" IS NULL
         UNION
         SELECT p."category_id"
         FROM "conversations" c
         INNER JOIN "posts" p ON p."id" = c."post_id"
         WHERE (c."member_low_id" = $1 OR c."member_high_id" = $1)
           AND p."deleted_at" IS NULL
         UNION
         SELECT p."category_id"
         FROM "phone_reveal_events" pre
         INNER JOIN "posts" p ON p."id" = pre."post_id"
         WHERE pre."viewer_id" = $1
           AND p."deleted_at" IS NULL
       ) AS activity_categories;`,
      [userId],
    );

    const prefRow = prefRes.rows[0];
    return {
      favoriteCategoryIds: Array.isArray(prefRow?.favorite_category_ids)
        ? prefRow.favorite_category_ids
        : [],
      interestKeywords: Array.isArray(prefRow?.interest_keywords)
        ? prefRow.interest_keywords
        : [],
      activityCategoryIds: activityRes.rows.map((row) => row.category_id),
    };
  }

  /**
   * Limited feed for PENDING accounts: omits price, budget, category, province, and owner.
   */
  async findPendingFeedPaginated(
    page: number,
    limit: number,
  ): Promise<{ rows: PendingFeedRow[]; total: number }> {
    const total = await this.countEligibleActivePosts();
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const offset = (page - 1) * limit;
    const rowsRes = await this.executeQuery<PendingFeedRow>(
      `SELECT
         p."id",
         p."title",
         p."post_type",
         p."created_at",
         img."storage_key" AS "thumbnail_storage_key"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       ${THUMBNAIL_LATERAL_JOIN}
       WHERE ${ELIGIBLE_ACTIVE_POST_WHERE}
       ORDER BY p."created_at" DESC, p."id" DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset],
    );

    return { rows: rowsRes.rows, total };
  }

  /**
   * Cold-start fallback for APPROVED users with no preferences and no activity history:
   * returns the newest active posts from approved owners.
   */
  async findApprovedColdStartFeedPaginated(
    page: number,
    limit: number,
  ): Promise<{ rows: ApprovedFeedRow[]; total: number }> {
    const total = await this.countEligibleActivePosts();
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const offset = (page - 1) * limit;
    const rowsRes = await this.executeQuery<ApprovedFeedRow>(
      `SELECT
         p."id", p."post_type", p."title", p."category_id", p."province", p."status", p."created_at",
         sd."price",
         brd."budget_min", brd."budget_max",
         img."storage_key" AS "thumbnail_storage_key"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
       LEFT JOIN "buy_request_details" brd ON brd."post_id" = p."id"
       ${THUMBNAIL_LATERAL_JOIN}
       WHERE ${ELIGIBLE_ACTIVE_POST_WHERE}
       ORDER BY p."created_at" DESC, p."id" DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset],
    );

    return { rows: rowsRes.rows, total };
  }

  /**
   * Rule-based personalized feed for APPROVED users with preferences or activity history.
   * Weights: favorite category (+4), keyword (+3), activity category (+2), province (+1).
   */
  async findApprovedPersonalizedFeedPaginated(params: {
    favoriteCategoryIds: string[];
    keywordPatterns: string[];
    activityCategoryIds: string[];
    viewerProvince: string | null;
    page: number;
    limit: number;
  }): Promise<{ rows: ApprovedFeedRow[]; total: number }> {
    const total = await this.countEligibleActivePosts();
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const offset = (params.page - 1) * params.limit;
    const rowsRes = await this.executeQuery<ApprovedFeedRow>(
      `WITH scored_posts AS (
         SELECT
           p."id", p."post_type", p."title", p."category_id", p."province", p."status", p."created_at",
           sd."price",
           brd."budget_min", brd."budget_max",
           img."storage_key" AS "thumbnail_storage_key",
           (CARDINALITY($1::text[]) > 0 AND p."category_id" = ANY($1::text[])) AS "matched_fav_category",
           (
             CARDINALITY($2::text[]) > 0
             AND (p."title" ILIKE ANY($2::text[]) OR p."description" ILIKE ANY($2::text[]))
           ) AS "matched_keyword",
           (CARDINALITY($3::text[]) > 0 AND p."category_id" = ANY($3::text[])) AS "matched_activity_category",
           (
             $4::text IS NOT NULL
             AND LOWER(TRIM(p."province")) = LOWER(TRIM($4::text))
           ) AS "matched_province"
         FROM "posts" p
         INNER JOIN "users" u ON u."id" = p."owner_id"
         LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
         LEFT JOIN "buy_request_details" brd ON brd."post_id" = p."id"
         ${THUMBNAIL_LATERAL_JOIN}
         WHERE ${ELIGIBLE_ACTIVE_POST_WHERE}
       )
       SELECT
         *,
         (
           (CASE WHEN "matched_fav_category" THEN 4 ELSE 0 END) +
           (CASE WHEN "matched_keyword" THEN 3 ELSE 0 END) +
           (CASE WHEN "matched_activity_category" THEN 2 ELSE 0 END) +
           (CASE WHEN "matched_province" THEN 1 ELSE 0 END)
         ) AS "relevance_score"
       FROM scored_posts
       ORDER BY "relevance_score" DESC, "created_at" DESC, "id" DESC
       LIMIT $5 OFFSET $6;`,
      [
        params.favoriteCategoryIds,
        params.keywordPatterns,
        params.activityCategoryIds,
        params.viewerProvince,
        params.limit,
        offset,
      ],
    );

    return { rows: rowsRes.rows, total };
  }

  private async countEligibleActivePosts(): Promise<number> {
    const res = await this.executeQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS "total"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       WHERE ${ELIGIBLE_ACTIVE_POST_WHERE};`,
    );
    return res.rows[0]?.total ?? 0;
  }
}
