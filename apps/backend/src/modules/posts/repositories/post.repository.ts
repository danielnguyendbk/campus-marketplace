import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../database/base.repository';
import { PostgresService } from '../../../database/postgres.service';
import { VerificationStatus } from '../../auth/auth.types';
import { PostStatus, PostType } from '../posts.types';

export interface PostRow {
  id: string;
  owner_id: string;
  post_type: PostType;
  title: string;
  description: string;
  category_id: string;
  province: string;
  status: PostStatus;
  close_reason: string | null;
  ended_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SellDetailRow {
  post_id: string;
  price: string | number;
  condition: string;
  allow_phone_reveal: boolean;
}

export interface BuyRequestDetailRow {
  post_id: string;
  budget_min: string | number;
  budget_max: string | number;
}

export interface PostImageRow {
  id: string;
  post_id: string;
  storage_key: string;
  sort_order: number;
}

export interface PostDetailRow extends PostRow {
  owner_display_name: string;
  owner_verification_status: VerificationStatus;
  owner_reputation_score: string | number;
  owner_province: string | null;
  price: string | number | null;
  condition: string | null;
  allow_phone_reveal: boolean | null;
  budget_min: string | number | null;
  budget_max: string | number | null;
}

export interface PostSummaryRow {
  id: string;
  post_type: PostType;
  title: string;
  category_id: string;
  province: string;
  status: PostStatus;
  price: string | number | null;
  budget_min: string | number | null;
  budget_max: string | number | null;
  thumbnail_storage_key: string | null;
  created_at: Date | string;
}

export interface PostPhoneRevealRow {
  id: string;
  seller_id: string;
  post_type: PostType;
  status: PostStatus;
  allow_phone_reveal: boolean | null;
  phone_number: string | null;
}

export interface PhoneRevealEventRow {
  id: string;
  viewer_id: string;
  post_id: string;
  seller_id: string;
  revealed_at: Date | string;
}

@Injectable()
export class PostRepository extends BaseRepository<PostRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'posts');
  }

  async insertPost(
    params: {
      ownerId: string;
      postType: PostType;
      title: string;
      description: string;
      categoryId: string;
      province: string;
    },
    client: PoolClient,
  ): Promise<PostRow> {
    const res = await this.executeQuery<PostRow>(
      `INSERT INTO "posts" ("owner_id", "post_type", "title", "description", "category_id", "province", "status")
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       RETURNING *;`,
      [
        params.ownerId,
        params.postType,
        params.title,
        params.description,
        params.categoryId,
        params.province,
      ],
      client,
    );
    return res.rows[0];
  }

  async insertSellDetails(
    params: {
      postId: string;
      price: number;
      condition: string;
      allowPhoneReveal: boolean;
    },
    client: PoolClient,
  ): Promise<SellDetailRow> {
    const res = await this.executeQuery<SellDetailRow>(
      `INSERT INTO "sell_details" ("post_id", "price", "condition", "allow_phone_reveal")
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [params.postId, params.price, params.condition, params.allowPhoneReveal],
      client,
    );
    return res.rows[0];
  }

  async insertBuyRequestDetails(
    params: { postId: string; budgetMin: number; budgetMax: number },
    client: PoolClient,
  ): Promise<BuyRequestDetailRow> {
    const res = await this.executeQuery<BuyRequestDetailRow>(
      `INSERT INTO "buy_request_details" ("post_id", "budget_min", "budget_max")
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [params.postId, params.budgetMin, params.budgetMax],
      client,
    );
    return res.rows[0];
  }

  async insertPostImages(
    postId: string,
    images: Array<{ storageKey: string; sortOrder: number }>,
    client: PoolClient,
  ): Promise<PostImageRow[]> {
    const inserted: PostImageRow[] = [];
    for (const img of images) {
      const res = await this.executeQuery<PostImageRow>(
        `INSERT INTO "post_images" ("post_id", "storage_key", "sort_order")
         VALUES ($1, $2, $3)
         RETURNING *;`,
        [postId, img.storageKey, img.sortOrder],
        client,
      );
      inserted.push(res.rows[0]);
    }
    return inserted;
  }

  async findPostDetailById(
    postId: string,
  ): Promise<{ post: PostDetailRow; images: PostImageRow[] } | null> {
    const postRes = await this.executeQuery<PostDetailRow>(
      `SELECT
         p."id", p."owner_id", p."post_type", p."title", p."description",
         p."category_id", p."province", p."status", p."close_reason",
         p."ended_at", p."created_at", p."updated_at",
         u."display_name" AS "owner_display_name",
         u."verification_status" AS "owner_verification_status",
         u."reputation_score" AS "owner_reputation_score",
         u."province" AS "owner_province",
         sd."price", sd."condition", sd."allow_phone_reveal",
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

    const post = postRes.rows[0];
    if (!post) {
      return null;
    }

    const imgRes = await this.executeQuery<PostImageRow>(
      `SELECT "id", "post_id", "storage_key", "sort_order"
       FROM "post_images"
       WHERE "post_id" = $1
       ORDER BY "sort_order" ASC, "id" ASC;`,
      [postId],
    );

    return { post, images: imgRes.rows };
  }

  async findMyPostsPaginated(
    ownerId: string,
    page: number,
    limit: number,
    status?: PostStatus,
  ): Promise<{ rows: PostSummaryRow[]; total: number }> {
    const params: unknown[] = [ownerId];
    let whereSql = `p."owner_id" = $1 AND p."deleted_at" IS NULL`;

    if (status) {
      params.push(status);
      whereSql += ` AND p."status" = $${params.length}`;
    }

    const totalRes = await this.executeQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM "posts" p WHERE ${whereSql};`,
      params,
    );
    const total = totalRes.rows[0]?.total ?? 0;

    const offset = (page - 1) * limit;
    const listParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const rowsRes = await this.executeQuery<PostSummaryRow>(
      `SELECT
         p."id", p."post_type", p."title", p."category_id", p."province", p."status", p."created_at",
         sd."price",
         brd."budget_min", brd."budget_max",
         img."storage_key" AS "thumbnail_storage_key"
       FROM "posts" p
       LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
       LEFT JOIN "buy_request_details" brd ON brd."post_id" = p."id"
       LEFT JOIN LATERAL (
         SELECT pi."storage_key"
         FROM "post_images" pi
         WHERE pi."post_id" = p."id"
         ORDER BY pi."sort_order" ASC, pi."id" ASC
         LIMIT 1
       ) img ON true
       WHERE ${whereSql}
       ORDER BY p."created_at" DESC, p."id" DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
      listParams,
    );

    return { rows: rowsRes.rows, total };
  }

  async findPostForPhoneReveal(postId: string): Promise<PostPhoneRevealRow | null> {
    const res = await this.executeQuery<PostPhoneRevealRow>(
      `SELECT
         p."id",
         p."owner_id" AS "seller_id",
         p."post_type",
         p."status",
         sd."allow_phone_reveal",
         u."phone_number"
       FROM "posts" p
       INNER JOIN "users" u ON u."id" = p."owner_id"
       LEFT JOIN "sell_details" sd ON sd."post_id" = p."id"
       WHERE p."id" = $1
         AND p."deleted_at" IS NULL
         AND u."deleted_at" IS NULL
       LIMIT 1;`,
      [postId],
    );
    return res.rows[0] ?? null;
  }

  async insertPhoneRevealEvent(
    viewerId: string,
    postId: string,
    sellerId: string,
  ): Promise<PhoneRevealEventRow> {
    const res = await this.executeQuery<PhoneRevealEventRow>(
      `INSERT INTO "phone_reveal_events" ("viewer_id", "post_id", "seller_id", "revealed_at")
       VALUES ($1, $2, $3, clock_timestamp())
       RETURNING "id", "viewer_id", "post_id", "seller_id", "revealed_at";`,
      [viewerId, postId, sellerId],
    );
    return res.rows[0];
  }
}
