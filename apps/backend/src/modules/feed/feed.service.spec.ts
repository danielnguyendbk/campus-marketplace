import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { StorageService } from '../../common/storage/storage.service';
import { FEED_MATCH_REASONS } from './feed.types';
import { FeedService } from './feed.service';
import {
  ApprovedFeedRow,
  FeedRepository,
  PendingFeedRow,
} from './repositories/feed.repository';

describe('FeedService', () => {
  const pendingUser: AuthenticatedUser = {
    id: 'user-pending',
    schoolEmail: 'pending@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'PENDING',
    province: 'TP. Hồ Chí Minh',
  };

  const approvedUser: AuthenticatedUser = {
    id: 'user-approved',
    schoolEmail: 'approved@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    province: 'TP. Hồ Chí Minh',
  };

  const adminPendingUser: AuthenticatedUser = {
    id: 'admin-1',
    schoolEmail: 'admin@ptithcm.edu.vn',
    role: 'ADMIN',
    verificationStatus: 'PENDING',
    province: 'Hà Nội',
  };

  let getPersonalizationSignalsMock: jest.Mock;
  let findPendingFeedPaginatedMock: jest.Mock;
  let findApprovedColdStartFeedPaginatedMock: jest.Mock;
  let findApprovedPersonalizedFeedPaginatedMock: jest.Mock;
  let getPublicUrlMock: jest.Mock;
  let service: FeedService;

  beforeEach(() => {
    getPersonalizationSignalsMock = jest.fn();
    findPendingFeedPaginatedMock = jest.fn();
    findApprovedColdStartFeedPaginatedMock = jest.fn();
    findApprovedPersonalizedFeedPaginatedMock = jest.fn();
    getPublicUrlMock = jest.fn((key: string) => `http://localhost:4000/uploads/${key}`);

    const repoMock = {
      getPersonalizationSignals: getPersonalizationSignalsMock,
      findPendingFeedPaginated: findPendingFeedPaginatedMock,
      findApprovedColdStartFeedPaginated: findApprovedColdStartFeedPaginatedMock,
      findApprovedPersonalizedFeedPaginated: findApprovedPersonalizedFeedPaginatedMock,
    } as unknown as FeedRepository;

    const storageMock = {
      getPublicUrl: getPublicUrlMock,
    } as unknown as StorageService;

    service = new FeedService(repoMock, storageMock);
  });

  it('returns strict 5-key PendingFeedItemDto objects for PENDING users (AC1)', async () => {
    const rows: PendingFeedRow[] = [
      {
        id: 'post-1',
        title: 'Giáo trình Cấu trúc dữ liệu',
        post_type: 'SELL',
        created_at: new Date('2026-11-24T10:00:00Z'),
        thumbnail_storage_key: 'posts/post-1/0-book.jpg',
      },
      {
        id: 'post-2',
        title: 'Tìm mua quạt đứng',
        post_type: 'BUY_REQUEST',
        created_at: '2026-11-23T09:00:00.000Z',
        thumbnail_storage_key: null,
      },
    ];
    findPendingFeedPaginatedMock.mockResolvedValueOnce({ rows, total: 2 });

    const res = await service.getFeed(pendingUser, { page: 1, limit: 20 });

    expect(findPendingFeedPaginatedMock).toHaveBeenCalledWith(1, 20);
    expect(getPersonalizationSignalsMock).not.toHaveBeenCalled();
    expect(res.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(res.data).toEqual([
      {
        id: 'post-1',
        title: 'Giáo trình Cấu trúc dữ liệu',
        postType: 'SELL',
        thumbnailUrl: 'http://localhost:4000/uploads/posts/post-1/0-book.jpg',
        createdAt: '2026-11-24T10:00:00.000Z',
      },
      {
        id: 'post-2',
        title: 'Tìm mua quạt đứng',
        postType: 'BUY_REQUEST',
        thumbnailUrl: null,
        createdAt: '2026-11-23T09:00:00.000Z',
      },
    ]);
    for (const item of res.data) {
      expect(Object.keys(item).sort()).toEqual([
        'createdAt',
        'id',
        'postType',
        'thumbnailUrl',
        'title',
      ]);
    }
  });

  it('uses cold-start fallback without matchedReasons when APPROVED user has no preferences or history (AC4)', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: [],
      interestKeywords: ['   '],
      activityCategoryIds: [],
    });
    const coldStartRows: ApprovedFeedRow[] = [
      {
        id: 'post-sell-1',
        post_type: 'SELL',
        title: 'Bàn học gỗ ép',
        category_id: 'FURNITURE',
        province: 'TP. Hồ Chí Minh',
        status: 'ACTIVE',
        created_at: new Date('2026-11-25T08:00:00Z'),
        price: '250000.00',
        budget_min: null,
        budget_max: null,
        thumbnail_storage_key: 'posts/post-sell-1/0.png',
      },
      {
        id: 'post-buy-1',
        post_type: 'BUY_REQUEST',
        title: 'Tìm mua sách xác suất thống kê',
        category_id: 'TEXTBOOK',
        province: 'Hà Nội',
        status: 'ACTIVE',
        created_at: new Date('2026-11-24T08:00:00Z'),
        price: null,
        budget_min: '30000.00',
        budget_max: '60000.00',
        thumbnail_storage_key: null,
      },
    ];
    findApprovedColdStartFeedPaginatedMock.mockResolvedValueOnce({
      rows: coldStartRows,
      total: 2,
    });

    const res = await service.getFeed(approvedUser, { page: 1, limit: 10 });

    expect(findApprovedColdStartFeedPaginatedMock).toHaveBeenCalledWith(1, 10);
    expect(findApprovedPersonalizedFeedPaginatedMock).not.toHaveBeenCalled();
    expect(res.meta).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    expect(res.data).toEqual([
      {
        id: 'post-sell-1',
        postType: 'SELL',
        title: 'Bàn học gỗ ép',
        categoryId: 'FURNITURE',
        province: 'TP. Hồ Chí Minh',
        status: 'ACTIVE',
        price: 250000,
        budgetMin: null,
        budgetMax: null,
        thumbnailUrl: 'http://localhost:4000/uploads/posts/post-sell-1/0.png',
        createdAt: '2026-11-25T08:00:00.000Z',
      },
      {
        id: 'post-buy-1',
        postType: 'BUY_REQUEST',
        title: 'Tìm mua sách xác suất thống kê',
        categoryId: 'TEXTBOOK',
        province: 'Hà Nội',
        status: 'ACTIVE',
        price: null,
        budgetMin: 30000,
        budgetMax: 60000,
        thumbnailUrl: null,
        createdAt: '2026-11-24T08:00:00.000Z',
      },
    ]);
  });

  it('deduplicates signals, escapes ILIKE special chars, and includes matchedReasons for personalized feed (AC3)', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: ['TEXTBOOK', ' TEXTBOOK '],
      interestKeywords: ['100%_java', 'Java', '100%_JAVA'],
      activityCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
    });
    findApprovedPersonalizedFeedPaginatedMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'post-match',
          post_type: 'SELL',
          title: 'Sách 100%_java thực chiến',
          category_id: 'TEXTBOOK',
          province: 'TP. Hồ Chí Minh',
          status: 'ACTIVE',
          created_at: new Date('2026-11-25T09:00:00Z'),
          price: '90000.00',
          budget_min: null,
          budget_max: null,
          thumbnail_storage_key: null,
          matched_fav_category: true,
          matched_keyword: true,
          matched_activity_category: false,
          matched_province: true,
        },
        {
          id: 'post-unmatched',
          post_type: 'SELL',
          title: 'Nồi cơm điện',
          category_id: 'APPLIANCES',
          province: 'Đà Nẵng',
          status: 'ACTIVE',
          created_at: new Date('2026-11-22T09:00:00Z'),
          price: '180000.00',
          budget_min: null,
          budget_max: null,
          thumbnail_storage_key: null,
          matched_fav_category: false,
          matched_keyword: false,
          matched_activity_category: false,
          matched_province: false,
        },
      ],
      total: 2,
    });

    const res = await service.getFeed(approvedUser, { page: 1, limit: 20 });

    expect(findApprovedPersonalizedFeedPaginatedMock).toHaveBeenCalledWith({
      favoriteCategoryIds: ['TEXTBOOK'],
      keywordPatterns: ['%100\\%\\_java%', '%Java%'],
      activityCategoryIds: ['ELECTRONICS'],
      viewerProvince: 'TP. Hồ Chí Minh',
      page: 1,
      limit: 20,
    });
    expect(res.data[0]).toMatchObject({
      id: 'post-match',
      matchedReasons: [
        FEED_MATCH_REASONS.FAVORITE_CATEGORY,
        FEED_MATCH_REASONS.INTEREST_KEYWORD,
        FEED_MATCH_REASONS.SAME_PROVINCE,
      ],
    });
    expect((res.data[1] as { matchedReasons?: string[] }).matchedReasons).toBeUndefined();
  });

  it('treats non-suspended ADMIN as full-feed viewer regardless of verificationStatus', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: [],
      interestKeywords: [],
      activityCategoryIds: ['APPLIANCES'],
    });
    findApprovedPersonalizedFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    const res = await service.getFeed(adminPendingUser, {});

    expect(findPendingFeedPaginatedMock).not.toHaveBeenCalled();
    expect(findApprovedPersonalizedFeedPaginatedMock).toHaveBeenCalledWith({
      favoriteCategoryIds: [],
      keywordPatterns: [],
      activityCategoryIds: ['APPLIANCES'],
      viewerProvince: 'Hà Nội',
      page: 1,
      limit: 20,
    });
    expect(res).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('clamps out-of-range page/limit defaults safely when called directly', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: [],
      interestKeywords: [],
      activityCategoryIds: [],
    });
    findApprovedColdStartFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    const res = await service.getFeed(approvedUser, { page: 0, limit: 500 });

    expect(findApprovedColdStartFeedPaginatedMock).toHaveBeenCalledWith(1, 100);
    expect(res.meta).toEqual({ page: 1, limit: 100, total: 0, totalPages: 0 });
  });

  it('reports totalPages = 0 when the eligible feed is empty (total = 0)', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: [],
      interestKeywords: [],
      activityCategoryIds: [],
    });
    findApprovedColdStartFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    const res = await service.getFeed(approvedUser, { page: 3, limit: 20 });

    expect(res.data).toEqual([]);
    expect(res.meta).toEqual({ page: 3, limit: 20, total: 0, totalPages: 0 });
  });

  it('escapes backslashes in interest keywords and deduplicates them case-insensitively', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: [],
      interestKeywords: ['a\\b', 'A\\B', '   '],
      activityCategoryIds: [],
    });
    findApprovedPersonalizedFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    await service.getFeed(approvedUser, { page: 1, limit: 20 });

    expect(findApprovedPersonalizedFeedPaginatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ keywordPatterns: ['%a\\\\b%'] }),
    );
  });

  it('removes activity categories already present in favorites and duplicates within activity history', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: ['TEXTBOOK'],
      interestKeywords: [],
      activityCategoryIds: ['TEXTBOOK', 'ELECTRONICS', 'ELECTRONICS'],
    });
    findApprovedPersonalizedFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    await service.getFeed(approvedUser, { page: 1, limit: 20 });

    expect(findApprovedPersonalizedFeedPaginatedMock).toHaveBeenCalledWith({
      favoriteCategoryIds: ['TEXTBOOK'],
      keywordPatterns: [],
      activityCategoryIds: ['ELECTRONICS'],
      viewerProvince: 'TP. Hồ Chí Minh',
      page: 1,
      limit: 20,
    });
  });

  it('passes a null province when the viewer profile province is blank', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: ['TEXTBOOK'],
      interestKeywords: [],
      activityCategoryIds: [],
    });
    findApprovedPersonalizedFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    await service.getFeed({ ...approvedUser, province: '   ' }, { page: 1, limit: 20 });

    expect(findApprovedPersonalizedFeedPaginatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ viewerProvince: null }),
    );
  });

  it('falls back to cold-start when stored signals contain only blank or non-string values', async () => {
    getPersonalizationSignalsMock.mockResolvedValueOnce({
      favoriteCategoryIds: ['', '  '],
      interestKeywords: [undefined as unknown as string, ''],
      activityCategoryIds: ['   '],
    });
    findApprovedColdStartFeedPaginatedMock.mockResolvedValueOnce({
      rows: [],
      total: 0,
    });

    await service.getFeed(approvedUser, { page: 1, limit: 20 });

    expect(findApprovedColdStartFeedPaginatedMock).toHaveBeenCalledWith(1, 20);
    expect(findApprovedPersonalizedFeedPaginatedMock).not.toHaveBeenCalled();
  });
});
