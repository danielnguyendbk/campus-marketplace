import { PostgresService } from '../../../database/postgres.service';
import { MatchingRepository } from './matching.repository';

describe('MatchingRepository', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const repo = new MatchingRepository(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns source post details with owner verification and price/budget in findSourcePostForMatching', async () => {
    const fakeSource = {
      id: 'post-src-1',
      owner_id: 'owner-1',
      post_type: 'SELL',
      title: 'Giáo trình Cấu trúc dữ liệu',
      description: 'Còn mới 95%',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      owner_verification_status: 'APPROVED',
      price: '80000.00',
      budget_min: null,
      budget_max: null,
    };
    queryMock.mockResolvedValueOnce({ rows: [fakeSource] });

    const result = await repo.findSourcePostForMatching('post-src-1');

    expect(result).toEqual(fakeSource);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain('LEFT JOIN "sell_details"');
    expect(String(sql)).toContain('LEFT JOIN "buy_request_details"');
    expect(String(sql)).toContain(
      'u."verification_status" AS "owner_verification_status"',
    );
    expect(params).toEqual(['post-src-1']);
  });

  it('returns null when findSourcePostForMatching finds no active non-deleted post', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const result = await repo.findSourcePostForMatching('missing-id');

    expect(result).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('skips scored query in findCounterpartMatchesPaginated when total is 0', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const result = await repo.findCounterpartMatchesPaginated({
      sourceOwnerId: 'owner-1',
      targetPostType: 'BUY_REQUEST',
      categoryId: 'TEXTBOOK',
      sourcePrice: 75000,
      sourceBudgetMin: null,
      sourceBudgetMax: null,
      keywordPatterns: ['%giáo%', '%trình%'],
      sourceProvince: 'Hà Nội',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({ rows: [], total: 0 });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual([
      'owner-1',
      'BUY_REQUEST',
      'TEXTBOOK',
    ]);
  });

  it('executes rule-based scoring SQL with exact $1..$10 params for SELL -> BUY_REQUEST', async () => {
    const fakeMatch = {
      id: 'buy-1',
      post_type: 'BUY_REQUEST',
      title: 'Tìm mua giáo trình Java',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T08:00:00Z'),
      price: null,
      budget_min: '50000.00',
      budget_max: '100000.00',
      thumbnail_storage_key: null,
      matched_category: true,
      matched_price_budget: true,
      matched_keyword: true,
      matched_province: true,
      relevance_score: 10,
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeMatch] });

    const result = await repo.findCounterpartMatchesPaginated({
      sourceOwnerId: 'seller-1',
      targetPostType: 'BUY_REQUEST',
      categoryId: 'TEXTBOOK',
      sourcePrice: 75000,
      sourceBudgetMin: null,
      sourceBudgetMax: null,
      keywordPatterns: ['%giáo%', '%java%'],
      sourceProvince: 'Hà Nội',
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({ rows: [fakeMatch], total: 1 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    const listSql = String(queryMock.mock.calls[1][0]);
    expect(listSql).toContain('WITH scored_matches AS');
    expect(listSql).toContain(`u."verification_status" = 'APPROVED'`);
    expect(listSql).toContain(`p."status" = 'ACTIVE'`);
    expect(listSql).toContain('p."owner_id" <> $1');
    expect(listSql).toContain('ORDER BY "relevance_score" DESC, "created_at" DESC, "id" DESC');
    expect(queryMock.mock.calls[1][1]).toEqual([
      'seller-1',
      'BUY_REQUEST',
      'TEXTBOOK',
      75000,
      null,
      null,
      ['%giáo%', '%java%'],
      'Hà Nội',
      10,
      10,
    ]);
  });

  it('executes rule-based scoring SQL with exact $1..$10 params for BUY_REQUEST -> SELL', async () => {
    const fakeMatch = {
      id: 'sell-1',
      post_type: 'SELL',
      title: 'Máy tính Casio fx-580VN X',
      category_id: 'ELECTRONICS',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T09:00:00Z'),
      price: '450000.00',
      budget_min: null,
      budget_max: null,
      thumbnail_storage_key: 'posts/sell-1/0.jpg',
      matched_category: true,
      matched_price_budget: true,
      matched_keyword: true,
      matched_province: false,
      relevance_score: 9,
    };
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeMatch] });

    const result = await repo.findCounterpartMatchesPaginated({
      sourceOwnerId: 'buyer-1',
      targetPostType: 'SELL',
      categoryId: 'ELECTRONICS',
      sourcePrice: null,
      sourceBudgetMin: 350000,
      sourceBudgetMax: 500000,
      keywordPatterns: ['%casio%'],
      sourceProvince: 'Hà Nội',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({ rows: [fakeMatch], total: 1 });
    expect(queryMock.mock.calls[1][1]).toEqual([
      'buyer-1',
      'SELL',
      'ELECTRONICS',
      null,
      350000,
      500000,
      ['%casio%'],
      'Hà Nội',
      20,
      0,
    ]);
  });
});
