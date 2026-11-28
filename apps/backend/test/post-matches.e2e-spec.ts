import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { StorageModule } from '../src/common/storage/storage.module';
import { DatabaseModule } from '../src/database/database.module';
import { PostgresService } from '../src/database/postgres.service';
import {
  ACCESS_TOKEN_JWT,
  UserRole,
  VerificationStatus,
} from '../src/modules/auth/auth.types';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { FeedModule } from '../src/modules/feed/feed.module';
import { POST_MATCH_REASONS } from '../src/modules/feed/feed.types';
import { PostsModule } from '../src/modules/posts/posts.module';
import { PostStatus, PostType } from '../src/modules/posts/posts.types';
import { UserModule } from '../src/modules/user/user.module';

interface FakeUserRecord {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  reputation_score: number;
  province: string | null;
  deleted_at: Date | null;
}

interface FakePostRecord {
  id: string;
  owner_id: string;
  post_type: PostType;
  title: string;
  description: string;
  category_id: string;
  province: string;
  status: PostStatus;
  close_reason: string | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const ilikePatternToRegex = (pattern: string): RegExp => {
  let regexSource = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      regexSource += next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    } else if (ch === '%') {
      regexSource += '.*';
    } else if (ch === '_') {
      regexSource += '.';
    } else {
      regexSource += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regexSource}$`, 'is');
};

class InMemoryPostgresForMatching {
  public users = new Map<string, FakeUserRecord>();
  public categories = [
    { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', is_active: true, sort_order: 1 },
    { id: 'ELECTRONICS', name: 'Thiết bị điện tử & Phụ kiện', slug: 'electronics', is_active: true, sort_order: 2 },
    { id: 'FURNITURE', name: 'Nội thất & Đồ dùng phòng trọ', slug: 'furniture', is_active: true, sort_order: 3 },
  ];
  public posts: FakePostRecord[] = [];
  public sellDetails = new Map<
    string,
    { post_id: string; price: string; condition: string; allow_phone_reveal: boolean }
  >();
  public buyRequestDetails = new Map<
    string,
    { post_id: string; budget_min: string; budget_max: string }
  >();
  public postImages: Array<{
    id: string;
    post_id: string;
    storage_key: string;
    sort_order: number;
  }> = [];

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  seedPost(
    post: Omit<FakePostRecord, 'close_reason' | 'ended_at' | 'updated_at' | 'deleted_at'> & {
      deleted_at?: Date | null;
      sellDetail?: { price: number; condition: string; allowPhoneReveal?: boolean };
      buyRequestDetail?: { budgetMin: number; budgetMax: number };
      thumbnailKey?: string;
    },
  ) {
    this.posts.push({
      id: post.id,
      owner_id: post.owner_id,
      post_type: post.post_type,
      title: post.title,
      description: post.description,
      category_id: post.category_id,
      province: post.province,
      status: post.status,
      close_reason: null,
      ended_at: null,
      created_at: post.created_at,
      updated_at: post.created_at,
      deleted_at: post.deleted_at ?? null,
    });
    if (post.sellDetail) {
      this.sellDetails.set(post.id, {
        post_id: post.id,
        price: post.sellDetail.price.toFixed(2),
        condition: post.sellDetail.condition,
        allow_phone_reveal: post.sellDetail.allowPhoneReveal ?? true,
      });
    }
    if (post.buyRequestDetail) {
      this.buyRequestDetails.set(post.id, {
        post_id: post.id,
        budget_min: post.buyRequestDetail.budgetMin.toFixed(2),
        budget_max: post.buyRequestDetail.budgetMax.toFixed(2),
      });
    }
    if (post.thumbnailKey) {
      this.postImages.push({
        id: randomUUID(),
        post_id: post.id,
        storage_key: post.thumbnailKey,
        sort_order: 0,
      });
    }
  }

  private getEligibleActivePosts(): FakePostRecord[] {
    return this.posts.filter((p) => {
      if (p.status !== 'ACTIVE' || p.deleted_at !== null) return false;
      const owner = this.users.get(p.owner_id);
      return (
        owner !== undefined &&
        owner.deleted_at === null &&
        owner.verification_status === 'APPROVED'
      );
    });
  }

  private getThumbnailKey(postId: string): string | null {
    const imgs = this.postImages
      .filter((img) => img.post_id === postId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return imgs[0]?.storage_key ?? null;
  }

  private getCounterpartCandidates(
    sourceOwnerId: string,
    targetPostType: PostType,
    categoryId: string,
  ): FakePostRecord[] {
    return this.getEligibleActivePosts().filter(
      (p) =>
        p.owner_id !== sourceOwnerId &&
        p.post_type === targetPostType &&
        p.category_id === categoryId,
    );
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.includes('FROM "users"') &&
      normalized.includes('WHERE "id" = $1 AND "deleted_at" IS NULL')
    ) {
      const user = this.users.get(String(params[0]));
      if (!user || user.deleted_at !== null) {
        return { rows: [] };
      }
      return { rows: [user] };
    }

    // MatchingRepository.findCounterpartMatchesPaginated COUNT query
    if (
      normalized.includes('SELECT COUNT(*)::int AS "total" FROM "posts" p') &&
      normalized.includes('p."owner_id" <> $1') &&
      normalized.includes('p."post_type" = $2') &&
      normalized.includes('p."category_id" = $3')
    ) {
      const candidates = this.getCounterpartCandidates(
        String(params[0]),
        params[1] as PostType,
        String(params[2]),
      );
      return { rows: [{ total: candidates.length }] };
    }

    // MatchingRepository.findCounterpartMatchesPaginated SCORED query
    if (normalized.startsWith('WITH scored_matches AS')) {
      const sourceOwnerId = String(params[0]);
      const targetPostType = params[1] as PostType;
      const categoryId = String(params[2]);
      const sourcePrice = params[3] !== null ? Number(params[3]) : null;
      const sourceBudgetMin = params[4] !== null ? Number(params[4]) : null;
      const sourceBudgetMax = params[5] !== null ? Number(params[5]) : null;
      const keywordRegexes = ((params[6] as string[]) ?? []).map(
        ilikePatternToRegex,
      );
      const sourceProvince =
        typeof params[7] === 'string' ? params[7].trim().toLowerCase() : null;
      const limit = Number(params[8]);
      const offset = Number(params[9]);

      const scored = this.getCounterpartCandidates(
        sourceOwnerId,
        targetPostType,
        categoryId,
      ).map((p) => {
        const sd = this.sellDetails.get(p.id);
        const brd = this.buyRequestDetails.get(p.id);

        let matchedPriceBudget = false;
        if (p.post_type === 'BUY_REQUEST') {
          const min = brd ? Number(brd.budget_min) : null;
          const max = brd ? Number(brd.budget_max) : null;
          matchedPriceBudget =
            sourcePrice !== null &&
            min !== null &&
            max !== null &&
            sourcePrice >= min &&
            sourcePrice <= max;
        } else if (p.post_type === 'SELL') {
          const price = sd ? Number(sd.price) : null;
          matchedPriceBudget =
            sourceBudgetMin !== null &&
            sourceBudgetMax !== null &&
            price !== null &&
            price >= sourceBudgetMin &&
            price <= sourceBudgetMax;
        }

        const matchedKeyword =
          keywordRegexes.length > 0 &&
          keywordRegexes.some(
            (rx) => rx.test(p.title) || rx.test(p.description),
          );
        const matchedProvince =
          sourceProvince !== null &&
          p.province.trim().toLowerCase() === sourceProvince;

        const relevanceScore =
          4 +
          (matchedPriceBudget ? 3 : 0) +
          (matchedKeyword ? 2 : 0) +
          (matchedProvince ? 1 : 0);

        return {
          id: p.id,
          post_type: p.post_type,
          title: p.title,
          category_id: p.category_id,
          province: p.province,
          status: p.status,
          created_at: p.created_at,
          price: sd ? sd.price : null,
          budget_min: brd ? brd.budget_min : null,
          budget_max: brd ? brd.budget_max : null,
          thumbnail_storage_key: this.getThumbnailKey(p.id),
          matched_category: true,
          matched_price_budget: matchedPriceBudget,
          matched_keyword: matchedKeyword,
          matched_province: matchedProvince,
          relevance_score: relevanceScore,
        };
      });

      scored.sort(
        (a, b) =>
          b.relevance_score - a.relevance_score ||
          b.created_at.getTime() - a.created_at.getTime() ||
          b.id.localeCompare(a.id),
      );

      return { rows: scored.slice(offset, offset + limit) };
    }

    // FeedRepository COUNT query (for AC5 Cold-Start feed discovery)
    if (
      normalized.includes('SELECT COUNT(*)::int AS "total" FROM "posts" p') &&
      normalized.includes(`u."verification_status" = 'APPROVED'`)
    ) {
      return { rows: [{ total: this.getEligibleActivePosts().length }] };
    }

    // FeedRepository Cold-Start query (AC5)
    if (
      normalized.includes('FROM "posts" p') &&
      normalized.includes('LEFT JOIN "sell_details"') &&
      normalized.includes(`u."verification_status" = 'APPROVED'`)
    ) {
      const limit = Number(params[0]);
      const offset = Number(params[1]);
      const sorted = [...this.getEligibleActivePosts()].sort(
        (a, b) =>
          b.created_at.getTime() - a.created_at.getTime() ||
          b.id.localeCompare(a.id),
      );
      return {
        rows: sorted.slice(offset, offset + limit).map((p) => {
          const sd = this.sellDetails.get(p.id);
          const brd = this.buyRequestDetails.get(p.id);
          return {
            id: p.id,
            post_type: p.post_type,
            title: p.title,
            category_id: p.category_id,
            province: p.province,
            status: p.status,
            created_at: p.created_at,
            price: sd ? sd.price : null,
            budget_min: brd ? brd.budget_min : null,
            budget_max: brd ? brd.budget_max : null,
            thumbnail_storage_key: this.getThumbnailKey(p.id),
          };
        }),
      };
    }

    // Source post / post detail lookup (MatchingRepository & PostRepository GET /posts/:id)
    if (
      normalized.includes('FROM "posts" p') &&
      normalized.includes('WHERE p."id" = $1')
    ) {
      const post = this.posts.find(
        (p) => p.id === params[0] && p.deleted_at === null,
      );
      if (!post) return { rows: [] };
      const owner = this.users.get(post.owner_id);
      if (!owner || owner.deleted_at !== null) return { rows: [] };
      const sd = this.sellDetails.get(post.id);
      const brd = this.buyRequestDetails.get(post.id);
      return {
        rows: [
          {
            ...post,
            owner_display_name: owner.display_name,
            owner_verification_status: owner.verification_status,
            owner_reputation_score: owner.reputation_score,
            owner_province: owner.province,
            price: sd ? sd.price : null,
            condition: sd ? sd.condition : null,
            allow_phone_reveal: sd ? sd.allow_phone_reveal : null,
            budget_min: brd ? brd.budget_min : null,
            budget_max: brd ? brd.budget_max : null,
          },
        ],
      };
    }

    if (normalized.includes('FROM "post_images"')) {
      const imgs = this.postImages
        .filter((img) => img.post_id === params[0])
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
      return { rows: imgs };
    }

    return { rows: [] };
  }
}

describe('CMP-14 — Bidirectional Counterpart Matching SELL <-> BUY_REQUEST (e2e)', () => {
  let app: INestApplication;
  const fakeDb = new InMemoryPostgresForMatching();

  const sellerAlice: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'alice@ptithcm.edu.vn',
    display_name: 'Alice Người Bán',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const buyerBob: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'bob@ptithcm.edu.vn',
    display_name: 'Bob Người Mua',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const brandNewApprovedViewer: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'newbie@ptithcm.edu.vn',
    display_name: 'Tân Sinh Viên Đã Duyệt',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'pending@ptithcm.edu.vn',
    display_name: 'Sinh Viên Chờ Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const rejectedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'rejected@ptithcm.edu.vn',
    display_name: 'Sinh Viên Từ Chối',
    role: 'USER',
    verification_status: 'REJECTED',
    reputation_score: 5.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'suspended@ptithcm.edu.vn',
    display_name: 'Tài Khoản Bị Khóa',
    role: 'USER',
    verification_status: 'SUSPENDED',
    reputation_score: 1.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  // Source posts
  const sellSourceTextbookId = randomUUID();
  const buySourceTextbookId = randomUUID();

  // Counterpart BUY_REQUEST candidates for sellSourceTextbookId
  const buyBestMatchId = randomUUID();
  const buyPartialNewerId = randomUUID();
  const buyPartialOlderId = randomUUID();

  // Counterpart SELL candidates for buySourceTextbookId
  const sellInBudgetId = randomUUID();
  const sellOutBudgetId = randomUUID();

  // Ineligible posts (must be excluded or yield 404)
  const buySameOwnerId = randomUUID();
  const buyOtherCategoryId = randomUUID();
  const sellOtherApprovedId = randomUUID();
  const buyHiddenId = randomUUID();
  const buyPendingOwnerId = randomUUID();
  const sellHiddenSourceId = randomUUID();
  const sellSuspendedOwnerSourceId = randomUUID();

  let approvedBuyerToken: string;
  let brandNewUserToken: string;
  let pendingToken: string;
  let rejectedToken: string;
  let suspendedWithStaleApprovedToken: string;

  beforeAll(async () => {
    fakeDb.seedUser(sellerAlice);
    fakeDb.seedUser(buyerBob);
    fakeDb.seedUser(brandNewApprovedViewer);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(rejectedUser);
    fakeDb.seedUser(suspendedUser);

    // 1. Source SELL post (Alice, TEXTBOOK, 65k, TP.HCM)
    fakeDb.seedPost({
      id: sellSourceTextbookId,
      owner_id: sellerAlice.id,
      post_type: 'SELL',
      title: 'Bán giáo trình Giải tích PTIT',
      description: 'Sách sạch sẽ, không rách trang',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T10:00:00Z'),
      sellDetail: { price: 65000, condition: 'Như mới' },
      thumbnailKey: 'posts/sell-gt/0.jpg',
    });

    // 2. Source BUY_REQUEST post (Bob, TEXTBOOK, 50k..80k, TP.HCM)
    fakeDb.seedPost({
      id: buySourceTextbookId,
      owner_id: buyerBob.id,
      post_type: 'BUY_REQUEST',
      title: 'Cần mua giáo trình Giải tích',
      description: 'Tìm bản in rõ',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T09:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });

    // 3. Best BUY_REQUEST counterpart (score 10: cat + price + keyword + province)
    fakeDb.seedPost({
      id: buyBestMatchId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm mua sách Giải tích cho sinh viên',
      description: 'Khu vực Thủ Đức PTIT',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-25T08:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });

    // 4. Lower-score BUY_REQUEST counterparts with different created_at (tie-breaker newest first)
    fakeDb.seedPost({
      id: buyPartialNewerId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm sách đại học',
      description: 'Ngân sách thấp hơn giá bán',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T12:00:00Z'),
      buyRequestDetail: { budgetMin: 20000, budgetMax: 40000 },
    });
    fakeDb.seedPost({
      id: buyPartialOlderId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm sách tham khảo kỳ 1',
      description: 'Cũ cũng được',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-24T12:00:00Z'),
      buyRequestDetail: { budgetMin: 20000, budgetMax: 40000 },
    });

    // 5. SELL counterparts for buySourceTextbookId
    fakeDb.seedPost({
      id: sellInBudgetId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'SELL',
      title: 'Bán giáo trình Giải tích tập 1',
      description: 'Sách mới tinh',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-25T07:00:00Z'),
      sellDetail: { price: 70000, condition: 'Mới' },
      thumbnailKey: 'posts/sell-in-budget/0.jpg',
    });
    fakeDb.seedPost({
      id: sellOutBudgetId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'SELL',
      title: 'Combo sách chuyên ngành',
      description: 'Nhiều quyển',
      category_id: 'TEXTBOOK',
      province: 'Đà Nẵng',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T13:00:00Z'),
      sellDetail: { price: 250000, condition: 'Tốt' },
    });

    // 6. Exclusions
    // Same owner as sellSourceTextbookId (Alice) -> excluded when matching Alice's sell post
    fakeDb.seedPost({
      id: buySameOwnerId,
      owner_id: sellerAlice.id,
      post_type: 'BUY_REQUEST',
      title: 'Alice tự đăng tìm Giải tích',
      description: 'Cùng chủ bài',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-27T01:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });
    // Different category
    fakeDb.seedPost({
      id: buyOtherCategoryId,
      owner_id: buyerBob.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm mua Casio Giải tích',
      description: 'Khác danh mục ELECTRONICS',
      category_id: 'ELECTRONICS',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-27T02:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });
    // Same post_type SELL (must not appear in SELL -> BUY_REQUEST matches)
    fakeDb.seedPost({
      id: sellOtherApprovedId,
      owner_id: brandNewApprovedViewer.id,
      post_type: 'SELL',
      title: 'Bán sách Giải tích khác',
      description: 'Cùng loại SELL',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-27T03:00:00Z'),
      sellDetail: { price: 65000, condition: 'Tốt' },
    });
    // HIDDEN counterpart
    fakeDb.seedPost({
      id: buyHiddenId,
      owner_id: buyerBob.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm Giải tích đã ẩn',
      description: 'HIDDEN',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'HIDDEN',
      created_at: new Date('2026-11-27T04:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });
    // Unapproved owner counterpart
    fakeDb.seedPost({
      id: buyPendingOwnerId,
      owner_id: pendingUser.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm Giải tích chủ pending',
      description: 'PENDING owner',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-27T05:00:00Z'),
      buyRequestDetail: { budgetMin: 50000, budgetMax: 80000 },
    });
    // Invalid source posts for 404 checks
    fakeDb.seedPost({
      id: sellHiddenSourceId,
      owner_id: sellerAlice.id,
      post_type: 'SELL',
      title: 'Bài SELL đã ẩn',
      description: 'HIDDEN source',
      category_id: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'HIDDEN',
      created_at: new Date('2026-11-26T01:00:00Z'),
      sellDetail: { price: 50000, condition: 'Cũ' },
    });
    fakeDb.seedPost({
      id: sellSuspendedOwnerSourceId,
      owner_id: suspendedUser.id,
      post_type: 'SELL',
      title: 'Bài SELL của tài khoản bị khóa',
      description: 'SUSPENDED owner source',
      category_id: 'TEXTBOOK',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-26T02:00:00Z'),
      sellDetail: { price: 50000, condition: 'Cũ' },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        StorageModule,
        CategoriesModule,
        PostsModule,
        UserModule,
        FeedModule,
      ],
    })
      .overrideProvider(PostgresService)
      .useValue(fakeDb)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    const accessJwt = moduleFixture.get<JwtService>(ACCESS_TOKEN_JWT);
    approvedBuyerToken = accessJwt.sign({
      sub: buyerBob.id,
      email: buyerBob.school_email,
      role: 'USER',
      verificationStatus: 'APPROVED',
      typ: 'access',
    });
    brandNewUserToken = accessJwt.sign({
      sub: brandNewApprovedViewer.id,
      email: brandNewApprovedViewer.school_email,
      role: 'USER',
      verificationStatus: 'APPROVED',
      typ: 'access',
    });
    pendingToken = accessJwt.sign({
      sub: pendingUser.id,
      email: pendingUser.school_email,
      role: 'USER',
      verificationStatus: 'PENDING',
      typ: 'access',
    });
    rejectedToken = accessJwt.sign({
      sub: rejectedUser.id,
      email: rejectedUser.school_email,
      role: 'USER',
      verificationStatus: 'REJECTED',
      typ: 'access',
    });
    suspendedWithStaleApprovedToken = accessJwt.sign({
      sub: suspendedUser.id,
      email: suspendedUser.school_email,
      role: 'USER',
      verificationStatus: 'APPROVED',
      typ: 'access',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('AC1 & AC3: matches SELL source post against BUY_REQUEST counterparts with scoring & exclusions', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 4,
      totalPages: 1,
    });

    const items = res.body.data as Array<{
      id: string;
      postType: string;
      matchedReasons: string[];
    }>;
    const ids = items.map((item) => item.id);

    // Every item must be BUY_REQUEST (never SELL, never same owner, never HIDDEN/PENDING/other category)
    expect(items.every((item) => item.postType === 'BUY_REQUEST')).toBe(true);
    expect(ids).not.toContain(buySameOwnerId);
    expect(ids).not.toContain(buyOtherCategoryId);
    expect(ids).not.toContain(sellOtherApprovedId);
    expect(ids).not.toContain(buyHiddenId);
    expect(ids).not.toContain(buyPendingOwnerId);

    // Both top-ranked items hit all 4 criteria (score 10), ordered newest-first (`buySourceTextbookId` > `buyBestMatchId`),
    // and tie-breaker also orders newer partial match (`buyPartialNewerId`) before older one (`buyPartialOlderId`).
    expect(ids.slice(0, 2)).toEqual([buySourceTextbookId, buyBestMatchId]);
    expect(items[0].matchedReasons).toEqual([
      POST_MATCH_REASONS.CATEGORY,
      POST_MATCH_REASONS.PRICE_BUDGET,
      POST_MATCH_REASONS.KEYWORD,
      POST_MATCH_REASONS.PROVINCE,
    ]);
    expect(ids.indexOf(buyPartialNewerId)).toBeLessThan(
      ids.indexOf(buyPartialOlderId),
    );
  });

  it('AC2 & AC3: matches BUY_REQUEST source post against SELL counterparts and orders in-budget matches first', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/posts/${buySourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(200);

    const items = res.body.data as Array<{
      id: string;
      postType: string;
      price: number | null;
      budgetMin: number | null;
      budgetMax: number | null;
      matchedReasons: string[];
    }>;
    const ids = items.map((item) => item.id);

    expect(items.every((item) => item.postType === 'SELL')).toBe(true);
    expect(ids).toEqual([
      sellOtherApprovedId,
      sellSourceTextbookId,
      sellInBudgetId,
      sellOutBudgetId,
    ]);
    expect(items[0].matchedReasons).toContain(POST_MATCH_REASONS.PRICE_BUDGET);
    expect(items[2].matchedReasons).toEqual([
      POST_MATCH_REASONS.CATEGORY,
      POST_MATCH_REASONS.PRICE_BUDGET,
      POST_MATCH_REASONS.KEYWORD,
    ]);
    expect(items[2].budgetMin).toBeNull();
    expect(items[2].budgetMax).toBeNull();
    expect(items[3].matchedReasons).toEqual([POST_MATCH_REASONS.CATEGORY]);
  });

  it('AC4: blocks Guest (401), PENDING/REJECTED (403 ACCOUNT_NOT_VERIFIED), and SUSPENDED (403 ACCOUNT_SUSPENDED)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .expect(401);

    const pendingRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(403);
    expect(pendingRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const rejectedRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${rejectedToken}`)
      .expect(403);
    expect(rejectedRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const suspendedRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${suspendedWithStaleApprovedToken}`)
      .expect(403);
    expect(suspendedRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('AC4: APPROVED user can open matched post detail via GET /api/v1/posts/:matchedId', async () => {
    const matchesRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches`)
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(200);

    const matchedId = matchesRes.body.data[0].id as string;
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${matchedId}`)
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(200);

    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data.id).toBe(matchedId);
    expect(detailRes.body.data.postType).toBe('BUY_REQUEST');
  });

  it('AC5: brand-new APPROVED user with zero preferences/history discovers newest feed, views matches, and opens detail', async () => {
    const feedRes = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${brandNewUserToken}`)
      .expect(200);

    const feedItems = feedRes.body.data as Array<{ id: string }>;
    expect(feedItems.length).toBeGreaterThan(0);

    const discoveredPostId = sellSourceTextbookId;
    const matchRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${discoveredPostId}/matches?page=1&limit=2`)
      .set('Authorization', `Bearer ${brandNewUserToken}`)
      .expect(200);

    expect(matchRes.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
    expect(matchRes.body.data).toHaveLength(2);

    const matchedId = matchRes.body.data[0].id as string;
    await request(app.getHttpServer())
      .get(`/api/v1/posts/${matchedId}`)
      .set('Authorization', `Bearer ${brandNewUserToken}`)
      .expect(200);
  });

  it('returns 400 VALIDATION_FAILED on invalid UUID or invalid/unknown pagination params, and 404 POST_NOT_FOUND on unavailable source posts', async () => {
    const badUuidRes = await request(app.getHttpServer())
      .get('/api/v1/posts/not-a-uuid/matches')
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(400);
    expect(badUuidRes.body.error.code).toBe('VALIDATION_FAILED');

    const badQueryRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${sellSourceTextbookId}/matches?page=0&extra=1`)
      .set('Authorization', `Bearer ${approvedBuyerToken}`)
      .expect(400);
    expect(badQueryRes.body.error.code).toBe('VALIDATION_FAILED');

    for (const invalidId of [
      randomUUID(),
      sellHiddenSourceId,
      sellSuspendedOwnerSourceId,
    ]) {
      const notFoundRes = await request(app.getHttpServer())
        .get(`/api/v1/posts/${invalidId}/matches`)
        .set('Authorization', `Bearer ${approvedBuyerToken}`)
        .expect(404);
      expect(notFoundRes.body.error.code).toBe('POST_NOT_FOUND');
    }
  });
});
