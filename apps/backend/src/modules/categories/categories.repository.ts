import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { PostgresService } from '../../database/postgres.service';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

const DEFAULT_CATEGORIES: ReadonlyArray<{
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}> = [
  { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', sortOrder: 1 },
  {
    id: 'ELECTRONICS',
    name: 'Thiết bị điện tử & Phụ kiện',
    slug: 'electronics',
    sortOrder: 2,
  },
  {
    id: 'FURNITURE',
    name: 'Nội thất & Đồ dùng phòng trọ',
    slug: 'furniture',
    sortOrder: 3,
  },
  {
    id: 'APPLIANCES',
    name: 'Đồ gia dụng sinh viên',
    slug: 'appliances',
    sortOrder: 4,
  },
  { id: 'OTHER', name: 'Đồ dùng khác', slug: 'other', sortOrder: 5 },
];

@Injectable()
export class CategoriesRepository extends BaseRepository<CategoryRow> {
  constructor(postgresService: PostgresService) {
    super(postgresService, 'categories');
  }

  async ensureDefaultCategories(): Promise<void> {
    for (const cat of DEFAULT_CATEGORIES) {
      await this.executeQuery(
        `INSERT INTO "categories" ("id", "name", "slug", "is_active", "sort_order")
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT ("id") DO NOTHING;`,
        [cat.id, cat.name, cat.slug, cat.sortOrder],
      );
    }
  }

  async findActivePaginated(
    page: number,
    limit: number,
  ): Promise<{ rows: CategoryRow[]; total: number }> {
    const totalRes = await this.executeQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM "categories" WHERE "is_active" = true;`,
    );
    let total = totalRes.rows[0]?.total ?? 0;

    if (total === 0) {
      await this.ensureDefaultCategories();
      const recountRes = await this.executeQuery<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM "categories" WHERE "is_active" = true;`,
      );
      total = recountRes.rows[0]?.total ?? 0;
    }

    const offset = (page - 1) * limit;
    const rowsRes = await this.executeQuery<CategoryRow>(
      `SELECT "id", "name", "slug", "sort_order"
       FROM "categories"
       WHERE "is_active" = true
       ORDER BY "sort_order" ASC, "id" ASC
       LIMIT $1 OFFSET $2;`,
      [limit, offset],
    );

    return {
      rows: rowsRes.rows,
      total,
    };
  }

  async findActiveById(id: string): Promise<CategoryRow | null> {
    const res = await this.executeQuery<CategoryRow>(
      `SELECT "id", "name", "slug", "sort_order"
       FROM "categories"
       WHERE "id" = $1 AND "is_active" = true
       LIMIT 1;`,
      [id],
    );
    return res.rows[0] ?? null;
  }
}
