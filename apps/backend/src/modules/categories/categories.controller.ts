import { Controller, Get, Query } from '@nestjs/common';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { CategoriesService, CategoryDto } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<CategoryDto>> {
    const parsedPage = page !== undefined ? Number(page) : undefined;
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    return this.categoriesService.listActiveCategories(parsedPage, parsedLimit);
  }
}
