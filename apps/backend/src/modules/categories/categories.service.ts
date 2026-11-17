import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { CategoriesRepository } from './categories.repository';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async listActiveCategories(
    rawPage?: number,
    rawLimit?: number,
  ): Promise<PaginatedResult<CategoryDto>> {
    const page = Number.isInteger(rawPage) && (rawPage as number) >= 1 ? (rawPage as number) : 1;
    const limit =
      Number.isInteger(rawLimit) && (rawLimit as number) >= 1
        ? Math.min(rawLimit as number, 100)
        : 20;

    const { rows, total } = await this.categoriesRepository.findActivePaginated(
      page,
      limit,
    );

    const data: CategoryDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sortOrder: Number(row.sort_order),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
