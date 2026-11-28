import { NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { StorageService } from '../../../common/storage/storage.service';
import { POST_MATCH_REASONS } from '../feed.types';
import { MatchingRepository } from '../repositories/matching.repository';
import { MatchingService } from './matching.service';

describe('MatchingService', () => {
  const matchingRepositoryMock = {
    findSourcePostForMatching: jest.fn(),
    findCounterpartMatchesPaginated: jest.fn(),
  } as unknown as jest.Mocked<MatchingRepository>;

  const storageServiceMock = {
    getPublicUrl: jest.fn(
      (key: string) => `http://localhost:3000/storage/${key}`,
    ),
  } as unknown as jest.Mocked<StorageService>;

  const service = new MatchingService(
    matchingRepositoryMock,
    storageServiceMock,
  );

  const approvedViewer: AuthenticatedUser = {
    id: 'viewer-1',
    schoolEmail: 'viewer@ptit.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    province: 'Hà Nội',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 404 POST_NOT_FOUND when source post does not exist', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce(
      null,
    );

    await expect(
      service.getPostMatches('post-missing', approvedViewer, {}),
    ).rejects.toThrow(NotFoundException);
    expect(
      matchingRepositoryMock.findCounterpartMatchesPaginated,
    ).not.toHaveBeenCalled();
  });

  it('throws 404 POST_NOT_FOUND when source post is not ACTIVE', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce({
      id: 'post-hidden',
      owner_id: 'owner-1',
      post_type: 'SELL',
      title: 'Giáo trình Java',
      description: 'Mới',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'HIDDEN',
      owner_verification_status: 'APPROVED',
      price: '50000.00',
      budget_min: null,
      budget_max: null,
    });

    await expect(
      service.getPostMatches('post-hidden', approvedViewer, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 POST_NOT_FOUND when source post owner is not APPROVED', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce({
      id: 'post-unverified-owner',
      owner_id: 'owner-pending',
      post_type: 'SELL',
      title: 'Giáo trình Java',
      description: 'Mới',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      owner_verification_status: 'PENDING',
      price: '50000.00',
      budget_min: null,
      budget_max: null,
    });

    await expect(
      service.getPostMatches('post-unverified-owner', approvedViewer, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('matches SELL source post against BUY_REQUEST counterparts and builds matchedReasons (AC1)', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce({
      id: 'sell-1',
      owner_id: 'seller-1',
      post_type: 'SELL',
      title: 'Bán giáo trình Mạng máy tính PTIT',
      description: 'Sách đẹp',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      owner_verification_status: 'APPROVED',
      price: '65000.00',
      budget_min: null,
      budget_max: null,
    });
    matchingRepositoryMock.findCounterpartMatchesPaginated.mockResolvedValueOnce({
      rows: [
        {
          id: 'buy-1',
          post_type: 'BUY_REQUEST',
          title: 'Tìm giáo trình mạng máy tính',
          category_id: 'TEXTBOOK',
          province: 'Hà Nội',
          status: 'ACTIVE',
          created_at: new Date('2026-11-27T08:00:00Z'),
          price: null,
          budget_min: '50000.00',
          budget_max: '80000.00',
          thumbnail_storage_key: null,
          matched_category: true,
          matched_price_budget: true,
          matched_keyword: true,
          matched_province: true,
          relevance_score: 10,
        },
      ],
      total: 1,
    });

    const result = await service.getPostMatches('sell-1', approvedViewer, {
      page: 1,
      limit: 10,
    });

    expect(
      matchingRepositoryMock.findCounterpartMatchesPaginated,
    ).toHaveBeenCalledWith({
      sourceOwnerId: 'seller-1',
      targetPostType: 'BUY_REQUEST',
      categoryId: 'TEXTBOOK',
      sourcePrice: 65000,
      sourceBudgetMin: null,
      sourceBudgetMax: null,
      keywordPatterns: ['%giáo%', '%trình%', '%mạng%', '%máy%', '%tính%', '%ptit%'],
      sourceProvince: 'Hà Nội',
      page: 1,
      limit: 10,
    });
    expect(result).toEqual({
      data: [
        {
          id: 'buy-1',
          postType: 'BUY_REQUEST',
          title: 'Tìm giáo trình mạng máy tính',
          categoryId: 'TEXTBOOK',
          province: 'Hà Nội',
          status: 'ACTIVE',
          price: null,
          budgetMin: 50000,
          budgetMax: 80000,
          thumbnailUrl: null,
          createdAt: '2026-11-27T08:00:00.000Z',
          matchedReasons: [
            POST_MATCH_REASONS.CATEGORY,
            POST_MATCH_REASONS.PRICE_BUDGET,
            POST_MATCH_REASONS.KEYWORD,
            POST_MATCH_REASONS.PROVINCE,
          ],
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('matches BUY_REQUEST source post against SELL counterparts with thumbnail URL (AC2)', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce({
      id: 'buy-1',
      owner_id: 'buyer-1',
      post_type: 'BUY_REQUEST',
      title: 'Cần mua Casio 580',
      description: 'Còn tốt',
      category_id: 'ELECTRONICS',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      owner_verification_status: 'APPROVED',
      price: null,
      budget_min: '300000.00',
      budget_max: '500000.00',
    });
    matchingRepositoryMock.findCounterpartMatchesPaginated.mockResolvedValueOnce({
      rows: [
        {
          id: 'sell-2',
          post_type: 'SELL',
          title: 'Casio fx-580VN X',
          category_id: 'ELECTRONICS',
          province: 'Hà Nội',
          status: 'ACTIVE',
          created_at: '2026-11-27T09:30:00.000Z',
          price: '420000.00',
          budget_min: null,
          budget_max: null,
          thumbnail_storage_key: 'posts/sell-2/0.jpg',
          matched_category: true,
          matched_price_budget: true,
          matched_keyword: true,
          matched_province: false,
          relevance_score: 9,
        },
      ],
      total: 1,
    });

    const result = await service.getPostMatches('buy-1', approvedViewer, {});

    expect(
      matchingRepositoryMock.findCounterpartMatchesPaginated,
    ).toHaveBeenCalledWith({
      sourceOwnerId: 'buyer-1',
      targetPostType: 'SELL',
      categoryId: 'ELECTRONICS',
      sourcePrice: null,
      sourceBudgetMin: 300000,
      sourceBudgetMax: 500000,
      keywordPatterns: ['%casio%', '%580%'],
      sourceProvince: 'TP. Hồ Chí Minh',
      page: 1,
      limit: 20,
    });
    expect(result.data[0]).toEqual({
      id: 'sell-2',
      postType: 'SELL',
      title: 'Casio fx-580VN X',
      categoryId: 'ELECTRONICS',
      province: 'Hà Nội',
      status: 'ACTIVE',
      price: 420000,
      budgetMin: null,
      budgetMax: null,
      thumbnailUrl: 'http://localhost:3000/storage/posts/sell-2/0.jpg',
      createdAt: '2026-11-27T09:30:00.000Z',
      matchedReasons: [
        POST_MATCH_REASONS.CATEGORY,
        POST_MATCH_REASONS.PRICE_BUDGET,
        POST_MATCH_REASONS.KEYWORD,
      ],
    });
  });

  it('caps limit at 100, defaults invalid query values, and returns totalPages 0 on empty matches', async () => {
    matchingRepositoryMock.findSourcePostForMatching.mockResolvedValueOnce({
      id: 'sell-empty',
      owner_id: 'seller-1',
      post_type: 'SELL',
      title: 'Bàn học gỗ',
      description: 'Mới',
      category_id: 'FURNITURE',
      province: 'Đà Nẵng',
      status: 'ACTIVE',
      owner_verification_status: 'APPROVED',
      price: '250000.00',
      budget_min: null,
      budget_max: null,
    });
    matchingRepositoryMock.findCounterpartMatchesPaginated.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    const result = await service.getPostMatches('sell-empty', approvedViewer, {
      page: -2,
      limit: 500,
    });

    expect(
      matchingRepositoryMock.findCounterpartMatchesPaginated,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 100,
      }),
    );
    expect(result).toEqual({
      data: [],
      meta: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('extractKeywordPatterns filters Vietnamese stop-words, deduplicates, escapes LIKE wildcards, and caps at 10', () => {
    expect(service.extractKeywordPatterns('   ')).toEqual([]);
    expect(
      service.extractKeywordPatterns(
        'Cần mua laptop%dell_2025 cũ còn tốt sinh viên laptop one two three four five six seven eight nine',
      ),
    ).toEqual([
      '%laptop%',
      '%dell%',
      '%2025%',
      '%one%',
      '%two%',
      '%three%',
      '%four%',
      '%five%',
      '%six%',
      '%seven%',
    ]);
    expect(service.extractKeywordPatterns('100% _test_\\x')).toEqual([
      '%100%',
      '%test%',
    ]);
  });

  it('escapes wildcard characters if token itself contains LIKE special symbols', () => {
    expect(
      service.extractKeywordPatterns('C++ % _ \\ alpha_beta'),
    ).toEqual(['%alpha%', '%beta%']);
  });
});
