import { PostgresService } from '../../../database/postgres.service';
import { FeedRepository } from './feed.repository';

describe('FeedRepository', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const repo = new FeedRepository(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collects preferences and interaction history categories in getPersonalizationSignals', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            favorite_category_ids: ['TEXTBOOK', 'ELECTRONICS'],
            interest_keywords: ['casio', 'java'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ category_id: 'FURNITURE' }, { category_id: 'TEXTBOOK' }],
      });

    const signals = await repo.getPersonalizationSignals('user-1');

    expect(signals).toEqual({
      favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
      interestKeywords: ['casio', 'java'],
      activityCategoryIds: ['FURNITURE', 'TEXTBOOK'],
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(String(queryMock.mock.calls[0][0])).toContain('FROM "user_preferences"');
    expect(String(queryMock.mock.calls[1][0])).toContain('FROM "conversations"');
    expect(String(queryMock.mock.calls[1][0])).toContain(
      'FROM "phone_reveal_events"',
    );
  });

  it('returns empty arrays when user has no user_preferences row or activity', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const signals = await repo.getPersonalizationSignals('user-new');

    expect(signals).toEqual({
      favoriteCategoryIds: [],
      interestKeywords: [],
      activityCategoryIds: [],
    });
  });

  it('skips detail query in findPendingFeedPaginated when total active eligible posts is 0', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const res = await repo.findPendingFeedPaginated(1, 20);

    expect(res).toEqual({ rows: [], total: 0 });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('queries limited fields only without sell_details or buy_request_details in findPendingFeedPaginated', async () => {
    const fakeRow = {
      id: 'post-1',
      title: 'Giáo trình Java',
      post_type: 'SELL',
      created_at: new Date('2026-11-20T08:00:00Z'),
      thumbnail_storage_key: 'posts/post-1/0.jpg',
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow] });

    const res = await repo.findPendingFeedPaginated(2, 10);

    expect(res).toEqual({ rows: [fakeRow], total: 1 });
    const listSql = String(queryMock.mock.calls[1][0]);
    expect(listSql).not.toContain('sell_details');
    expect(listSql).not.toContain('buy_request_details');
    expect(listSql).toContain(`u."verification_status" = 'APPROVED'`);
    expect(listSql).toContain(`p."status" = 'ACTIVE'`);
    expect(queryMock.mock.calls[1][1]).toEqual([10, 10]);
  });

  it('orders by created_at DESC, id DESC in findApprovedColdStartFeedPaginated', async () => {
    const fakeRow = {
      id: 'post-2',
      post_type: 'BUY_REQUEST',
      title: 'Tìm mua bàn học',
      category_id: 'FURNITURE',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-21T08:00:00Z'),
      price: null,
      budget_min: '100000.00',
      budget_max: '200000.00',
      thumbnail_storage_key: null,
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow] });

    const res = await repo.findApprovedColdStartFeedPaginated(1, 20);

    expect(res).toEqual({ rows: [fakeRow], total: 1 });
    const listSql = String(queryMock.mock.calls[1][0]);
    expect(listSql).toContain('ORDER BY p."created_at" DESC, p."id" DESC');
    expect(queryMock.mock.calls[1][1]).toEqual([20, 0]);
  });

  it('passes personalization parameters and orders by relevance_score DESC in findApprovedPersonalizedFeedPaginated', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [] });

    await repo.findApprovedPersonalizedFeedPaginated({
      favoriteCategoryIds: ['TEXTBOOK'],
      keywordPatterns: ['%casio%'],
      activityCategoryIds: ['ELECTRONICS'],
      viewerProvince: 'TP. Hồ Chí Minh',
      page: 1,
      limit: 15,
    });

    const listSql = String(queryMock.mock.calls[1][0]);
    expect(listSql).toContain('WITH scored_posts AS');
    expect(listSql).toContain('ORDER BY "relevance_score" DESC, "created_at" DESC');
    expect(queryMock.mock.calls[1][1]).toEqual([
      ['TEXTBOOK'],
      ['%casio%'],
      ['ELECTRONICS'],
      'TP. Hồ Chí Minh',
      15,
      0,
    ]);
  });
});
