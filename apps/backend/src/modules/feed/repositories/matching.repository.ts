import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { VerificationStatus } from '../../auth/auth.types';
import { PostStatus, PostType } from '../../posts/posts.types';
import { ApprovedFeedRow } from './feed.repository';

export interface SourcePostForMatchingRow {
  id: string;
  owner_id: string;
  post_type: PostType;
  title: string;
  description: string;
  category_id: string;
  province: string;
  status: PostStatus;
  owner_verification_status: VerificationStatus;
  price: string | number | null;
  budget_min: string | number | null;
  budget_max: string | number | null;
}

export interface MatchedCounterpartRow extends ApprovedFeedRow {
  matched_category: boolean;
  matched_price_budget: boolean;
  matched_keyword: boolean;
  matched_province: boolean;
  relevance_score: number;
}

export interface FindCounterpartMatchesParams {
  sourceOwnerId: string;
  targetPostType: PostType;
  categoryId: string;
  sourcePrice: number | null;
  sourceBudgetMin: number | null;
  sourceBudgetMax: number | null;
  keywordPatterns: string[];
  sourceProvince: string;
  page: number;
  limit: number;
}

const COUNTERPART_BASE_WHERE = `
  p."status" = 'ACTIVE'
  AND p."deleted_at" IS NULL
  AND u."deleted_at" IS NULL
  AND u."verification_status" = 'APPROVED'
  AND p."owner_id" <> $1
  AND p."post_type" = $2
  AND p."category_id" = $3
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
export class MatchingRepository extends BaseRepository<MatchedCounterpartRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'posts');
  }

  /**
   * Loads the source post along with owner verification status and pricing/budget
   * details for counterpart validation and rule-based scoring.
   */
  async findSourcePostForMatching(
    postId: string,
  ): Promise<SourcePostForMatchingRow | null> {
    const res = await this.executeQuery<SourcePostForMatchingRow>(
      `SELECT
         p."id", p."owner_id", p."post_type", p."title", p."description",
         p."category_id", p."province", p."status",
         u."verification_status" AS "owner_verification_status",
         sd."price",
         brd."budget_min", brd."budget_max"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
       LEFT JOIN "buy_request_details" brd ON brd."post_id" = p."id"
       WHERE p."id" = $1
         AND p."deleted_at" IS NULL
         AND u."deleted_at" IS NULL
       LIMIT 1;`,
      [postId],
    );
    return res.rows[0] ?? null;
  }

  /**
   * Finds paginated ACTIVE counterpart posts owned by APPROVED users in the same
   * category, scored by rule-based compatibility and ordered by newest first on ties.
   */
  async findCounterpartMatchesPaginated(
    params: FindCounterpartMatchesParams,
  ): Promise<{ rows: MatchedCounterpartRow[]; total: number }> {
    const baseArgs = [
      params.sourceOwnerId,
      params.targetPostType,
      params.categoryId,
    ];

    const countRes = await this.executeQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS "total"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       WHERE ${COUNTERPART_BASE_WHERE};`,
      baseArgs,
    );
    const total = countRes.rows[0]?.total ?? 0;
    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const offset = (params.page - 1) * params.limit;
    const rowsRes = await this.executeQuery<MatchedCounterpartRow>(
      `WITH scored_matches AS (
         SELECT
           p."id", p."post_type", p."title", p."category_id", p."province", p."status", p."created_at",
           sd."price",
           brd."budget_min", brd."budget_max",
           img."storage_key" AS "thumbnail_storage_key",
           true AS "matched_category",
           (
             CASE
               WHEN p."post_type" = 'BUY_REQUEST' THEN
                 ($4::numeric IS NOT NULL AND brd."budget_min" IS NOT NULL AND brd."budget_max" IS NOT NULL
                  AND $4::numeric >= brd."budget_min" AND $4::numeric <= brd."budget_max")
               WHEN p."post_type" = 'SELL' THEN
                 ($5::numeric IS NOT NULL AND $6::numeric IS NOT NULL AND sd."price" IS NOT NULL
                  AND sd."price" >= $5::numeric AND sd."price" <= $6::numeric)
               ELSE false
             END
           ) AS "matched_price_budget",
           (
             CARDINALITY($7::text[]) > 0
             AND (p."title" ILIKE ANY($7::text[]) OR p."description" ILIKE ANY($7::text[]))
           ) AS "matched_keyword",
           (
             $8::text IS NOT NULL
             AND LOWER(TRIM(p."province")) = LOWER(TRIM($8::text))
           ) AS "matched_province"
         FROM "posts" p
         INNER JOIN "users" u ON u."id" = p."owner_id"
         LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
         LEFT JOIN "buy_request_details" brd ON brd."post_id" = p."id"
         ${THUMBNAIL_LATERAL_JOIN}
         WHERE ${COUNTERPART_BASE_WHERE}
       )
       SELECT
         *,
         (
           4 +
           (CASE WHEN "matched_price_budget" THEN 3 ELSE 0 END) +
           (CASE WHEN "matched_keyword" THEN 2 ELSE 0 END) +
           (CASE WHEN "matched_province" THEN 1 ELSE 0 END)
         ) AS "relevance_score"
       FROM scored_matches
       ORDER BY "relevance_score" DESC, "created_at" DESC, "id" DESC
       LIMIT $9 OFFSET $10;`,
      [
        params.sourceOwnerId,
        params.targetPostType,
        params.categoryId,
        params.sourcePrice,
        params.sourceBudgetMin,
        params.sourceBudgetMax,
        params.keywordPatterns,
        params.sourceProvince,
        params.limit,
        offset,
      ],
    );

    return { rows: rowsRes.rows, total };
  }
}
