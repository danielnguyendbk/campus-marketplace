import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const findActivePaginatedMock = jest.fn();
  const repoMock = {
    findActivePaginated: findActivePaginatedMock,
  } as unknown as CategoriesRepository;

  const service = new CategoriesService(repoMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps database category rows to OpenAPI CategoryDto and calculates PageMeta', async () => {
    findActivePaginatedMock.mockResolvedValueOnce({
      rows: [
        { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', sort_order: 1 },
        { id: 'OTHER', name: 'Đồ dùng khác', slug: 'other', sort_order: 5 },
      ],
      total: 5,
    });

    const result = await service.listActiveCategories(1, 2);

    expect(findActivePaginatedMock).toHaveBeenCalledWith(1, 2);
    expect(result).toEqual({
      data: [
        { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', sortOrder: 1 },
        { id: 'OTHER', name: 'Đồ dùng khác', slug: 'other', sortOrder: 5 },
      ],
      meta: {
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      },
    });
  });

  it('sanitizes invalid page/limit values to safe defaults', async () => {
    findActivePaginatedMock.mockResolvedValueOnce({ rows: [], total: 0 });
    const result = await service.listActiveCategories(-5, 500);
    expect(findActivePaginatedMock).toHaveBeenCalledWith(1, 100);
    expect(result.meta).toEqual({ page: 1, limit: 100, total: 0, totalPages: 0 });
  });
});
