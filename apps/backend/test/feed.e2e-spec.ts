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
  OTP_TICKET_JWT,
  UserRole,
  VerificationStatus,
} from '../src/modules/auth/auth.types';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { ChatModule } from '../src/modules/chat/chat.module';
import { FEED_MATCH_REASONS } from '../src/modules/feed/feed.types';
import { FeedModule } from '../src/modules/feed/feed.module';
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

interface FakePreferenceRecord {
  user_id: string;
  favorite_category_ids: string[];
  interest_keywords: string[];
  updated_at: Date;
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

class InMemoryPostgresForFeed {
  public users = new Map<string, FakeUserRecord>();
  public categories = [
    { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', is_active: true, sort_order: 1 },
    { id: 'ELECTRONICS', name: 'Thiết bị điện tử & Phụ kiện', slug: 'electronics', is_active: true, sort_order: 2 },
    { id: 'FURNITURE', name: 'Nội thất & Đồ dùng phòng trọ', slug: 'furniture', is_active: true, sort_order: 3 },
    { id: 'APPLIANCES', name: 'Đồ gia dụng sinh viên', slug: 'appliances', is_active: true, sort_order: 4 },
    { id: 'OTHER', name: 'Đồ dùng khác', slug: 'other', is_active: true, sort_order: 5 },
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
  public preferences = new Map<string, FakePreferenceRecord>();
  public conversations: Array<{
    id: string;
    post_id: string;
    member_low_id: string;
    member_high_id: string;
  }> = [];
  public phoneRevealEvents: Array<{
    id: string;
    viewer_id: string;
    post_id: string;
    seller_id: string;
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
    const record: FakePostRecord = {
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
    };
    this.posts.push(record);
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
    const images = this.postImages
      .filter((img) => img.post_id === postId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return images[0]?.storage_key ?? null;
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

    if (
      normalized.includes('FROM "categories"') &&
      normalized.includes('WHERE "id" = $1')
    ) {
      const cat = this.categories.find((c) => c.id === params[0] && c.is_active);
      return { rows: cat ? [cat] : [] };
    }

    if (normalized.includes('FROM "user_preferences"') && normalized.startsWith('SELECT')) {
      const pref = this.preferences.get(String(params[0]));
      return { rows: pref ? [pref] : [] };
    }

    if (normalized.startsWith('INSERT INTO "user_preferences"')) {
      const record: FakePreferenceRecord = {
        user_id: String(params[0]),
        favorite_category_ids: (params[1] as string[]) ?? [],
        interest_keywords: (params[2] as string[]) ?? [],
        updated_at: new Date(),
      };
      this.preferences.set(record.user_id, record);
      return { rows: [record] };
    }

    if (normalized.includes('AS activity_categories')) {
      const userId = String(params[0]);
      const categorySet = new Set<string>();
      for (const p of this.posts) {
        if (p.owner_id === userId && p.deleted_at === null) {
          categorySet.add(p.category_id);
        }
      }
      for (const conv of this.conversations) {
        if (conv.member_low_id === userId || conv.member_high_id === userId) {
          const post = this.posts.find((p) => p.id === conv.post_id && p.deleted_at === null);
          if (post) categorySet.add(post.category_id);
        }
      }
      for (const reveal of this.phoneRevealEvents) {
        if (reveal.viewer_id === userId) {
          const post = this.posts.find((p) => p.id === reveal.post_id && p.deleted_at === null);
          if (post) categorySet.add(post.category_id);
        }
      }
      return {
        rows: Array.from(categorySet).map((category_id) => ({ category_id })),
      };
    }

    if (
      normalized.includes('SELECT COUNT(*)::int AS "total" FROM "posts" p') &&
      normalized.includes(`u."verification_status" = 'APPROVED'`)
    ) {
      return { rows: [{ total: this.getEligibleActivePosts().length }] };
    }

    if (normalized.startsWith('WITH scored_posts AS')) {
      const favoriteCategoryIds = (params[0] as string[]) ?? [];
      const keywordRegexes = ((params[1] as string[]) ?? []).map(ilikePatternToRegex);
      const activityCategoryIds = (params[2] as string[]) ?? [];
      const viewerProvince =
        typeof params[3] === 'string' ? params[3].trim().toLowerCase() : null;
      const limit = Number(params[4]);
      const offset = Number(params[5]);

      const scored = this.getEligibleActivePosts().map((p) => {
        const sd = this.sellDetails.get(p.id);
        const brd = this.buyRequestDetails.get(p.id);
        const matchedFavCategory =
          favoriteCategoryIds.length > 0 && favoriteCategoryIds.includes(p.category_id);
        const matchedKeyword =
          keywordRegexes.length > 0 &&
          keywordRegexes.some((rx) => rx.test(p.title) || rx.test(p.description));
        const matchedActivityCategory =
          activityCategoryIds.length > 0 && activityCategoryIds.includes(p.category_id);
        const matchedProvince =
          viewerProvince !== null && p.province.trim().toLowerCase() === viewerProvince;

        const relevanceScore =
          (matchedFavCategory ? 4 : 0) +
          (matchedKeyword ? 3 : 0) +
          (matchedActivityCategory ? 2 : 0) +
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
          matched_fav_category: matchedFavCategory,
          matched_keyword: matchedKeyword,
          matched_activity_category: matchedActivityCategory,
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

    if (
      normalized.includes('FROM "posts" p') &&
      !normalized.includes('sell_details') &&
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
        rows: sorted.slice(offset, offset + limit).map((p) => ({
          id: p.id,
          title: p.title,
          post_type: p.post_type,
          created_at: p.created_at,
          thumbnail_storage_key: this.getThumbnailKey(p.id),
        })),
      };
    }

    if (
      normalized.includes('FROM "posts" p') &&
      normalized.includes('WHERE p."id" = $1')
    ) {
      const post = this.posts.find((p) => p.id === params[0] && p.deleted_at === null);
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

describe('CMP-12 — Tiered Feed & Cold-Start Fallback (e2e)', () => {
  let app: INestApplication;
  const fakeDb = new InMemoryPostgresForFeed();

  const approvedSeller: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'seller.approved@ptithcm.edu.vn',
    display_name: 'Người bán Đã Duyệt',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const coldStartApprovedBuyer: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'buyer.new@ptithcm.edu.vn',
    display_name: 'Sinh viên Mới Duyệt',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const personalizedApprovedBuyer: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'buyer.prefs@ptithcm.edu.vn',
    display_name: 'Sinh viên Có Sở Thích',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'pending@ptithcm.edu.vn',
    display_name: 'Sinh viên Chờ Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const rejectedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'rejected@ptithcm.edu.vn',
    display_name: 'Sinh viên Bị Từ Chối',
    role: 'USER',
    verification_status: 'REJECTED',
    reputation_score: 5.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'suspended@ptithcm.edu.vn',
    display_name: 'Tài khoản Bị Khóa',
    role: 'USER',
    verification_status: 'SUSPENDED',
    reputation_score: 1.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  const softDeletedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'deleted@ptithcm.edu.vn',
    display_name: 'Tài khoản Đã Xóa',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'Hà Nội',
    deleted_at: new Date('2026-11-20T00:00:00Z'),
  };

  const adminUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'admin@ptithcm.edu.vn',
    display_name: 'Quản trị viên',
    role: 'ADMIN',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    deleted_at: null,
  };

  const unapprovedPostOwner: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'owner.pending@ptithcm.edu.vn',
    display_name: 'Chủ bài Chưa Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: 'Hà Nội',
    deleted_at: null,
  };

  const postNewestOtherId = randomUUID();
  const postCasioElectronicsId = randomUUID();
  const postTextbookBuyId = randomUUID();
  const postHiddenId = randomUUID();
  const postPendingOwnerId = randomUUID();

  let approvedSellerToken: string;
  let coldStartStalePendingToken: string;
  let personalizedToken: string;
  let pendingToken: string;
  let rejectedToken: string;
  let suspendedWithStaleApprovedToken: string;
  let softDeletedToken: string;
  let adminToken: string;
  let otpTicketToken: string;

  beforeAll(async () => {
    fakeDb.seedUser(approvedSeller);
    fakeDb.seedUser(coldStartApprovedBuyer);
    fakeDb.seedUser(personalizedApprovedBuyer);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(rejectedUser);
    fakeDb.seedUser(suspendedUser);
    fakeDb.seedUser(softDeletedUser);
    fakeDb.seedUser(adminUser);
    fakeDb.seedUser(unapprovedPostOwner);

    // 3 eligible ACTIVE posts from an APPROVED owner
    fakeDb.seedPost({
      id: postNewestOtherId,
      owner_id: approvedSeller.id,
      post_type: 'SELL',
      title: 'Tủ nhựa phòng trọ 4 tầng',
      description: 'Còn mới 90%, tự vận chuyển',
      category_id: 'FURNITURE',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-25T10:00:00Z'),
      sellDetail: { price: 320000, condition: 'Như mới', allowPhoneReveal: true },
      thumbnailKey: 'posts/furniture-1/0.jpg',
    });
    fakeDb.seedPost({
      id: postCasioElectronicsId,
      owner_id: approvedSeller.id,
      post_type: 'SELL',
      title: 'Máy tính Casio fx-580VN X chính hãng',
      description: 'Dùng ổn định cho sinh viên kỹ thuật',
      category_id: 'ELECTRONICS',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      created_at: new Date('2026-11-24T10:00:00Z'),
      sellDetail: { price: 450000, condition: 'Tốt', allowPhoneReveal: false },
      thumbnailKey: 'posts/casio-1/0.jpg',
    });
    fakeDb.seedPost({
      id: postTextbookBuyId,
      owner_id: approvedSeller.id,
      post_type: 'BUY_REQUEST',
      title: 'Tìm mua giáo trình Mạng máy tính',
      description: 'Cần sách bản in rõ nét',
      category_id: 'TEXTBOOK',
      province: 'Đà Nẵng',
      status: 'ACTIVE',
      created_at: new Date('2026-11-23T10:00:00Z'),
      buyRequestDetail: { budgetMin: 40000, budgetMax: 90000 },
    });

    // Ineligible posts (must never appear in feed)
    fakeDb.seedPost({
      id: postHiddenId,
      owner_id: approvedSeller.id,
      post_type: 'SELL',
      title: 'Bài viết đã ẩn',
      description: 'Không được hiển thị',
      category_id: 'OTHER',
      province: 'Hà Nội',
      status: 'HIDDEN',
      created_at: new Date('2026-11-25T11:00:00Z'),
      sellDetail: { price: 50000, condition: 'Cũ' },
    });
    fakeDb.seedPost({
      id: postPendingOwnerId,
      owner_id: unapprovedPostOwner.id,
      post_type: 'SELL',
      title: 'Bài của chủ tài khoản chưa duyệt',
      description: 'Không được hiển thị trên bảng tin công khai',
      category_id: 'OTHER',
      province: 'Hà Nội',
      status: 'ACTIVE',
      created_at: new Date('2026-11-25T12:00:00Z'),
      sellDetail: { price: 70000, condition: 'Mới' },
    });

    // Activity history (conversation on TEXTBOOK) for personalizedApprovedBuyer
    fakeDb.conversations.push({
      id: randomUUID(),
      post_id: postTextbookBuyId,
      member_low_id: approvedSeller.id,
      member_high_id: personalizedApprovedBuyer.id,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        StorageModule,
        CategoriesModule,
        PostsModule,
        ChatModule,
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
    const otpTicketJwt = moduleFixture.get<JwtService>(OTP_TICKET_JWT);

    approvedSellerToken = accessJwt.sign({
      sub: approvedSeller.id,
      email: approvedSeller.school_email,
      role: 'USER',
      verificationStatus: 'APPROVED',
      typ: 'access',
    });
    coldStartStalePendingToken = accessJwt.sign({
      sub: coldStartApprovedBuyer.id,
      email: coldStartApprovedBuyer.school_email,
      role: 'USER',
      verificationStatus: 'PENDING', // Stale JWT: DB already approved
      typ: 'access',
    });
    personalizedToken = accessJwt.sign({
      sub: personalizedApprovedBuyer.id,
      email: personalizedApprovedBuyer.school_email,
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
      verificationStatus: 'APPROVED', // Stale JWT: DB suspended
      typ: 'access',
    });
    softDeletedToken = accessJwt.sign({
      sub: softDeletedUser.id,
      email: softDeletedUser.school_email,
      role: 'USER',
      verificationStatus: 'APPROVED',
      typ: 'access',
    });
    adminToken = accessJwt.sign({
      sub: adminUser.id,
      email: adminUser.school_email,
      role: 'ADMIN',
      verificationStatus: 'PENDING',
      typ: 'access',
    });
    otpTicketToken = otpTicketJwt.sign({
      sub: approvedSeller.school_email,
      otpId: randomUUID(),
      typ: 'otp_ticket',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC5: blocks unauthenticated, malformed, and otp_ticket callers with 401 UNAUTHORIZED', async () => {
    const noAuth = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .expect(401);
    expect(noAuth.body.error.code).toBe('UNAUTHORIZED');

    await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${otpTicketToken}`)
      .expect(401);
  });

  it('AC5: blocks REJECTED and live-DB SUSPENDED accounts regardless of stale JWT status', async () => {
    const rejRes = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${rejectedToken}`)
      .expect(403);
    expect(rejRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const susRes = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${suspendedWithStaleApprovedToken}`)
      .expect(403);
    expect(susRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('AC5: returns 401 UNAUTHORIZED for soft-deleted accounts even with a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${softDeletedToken}`)
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('AC1 & AC5: returns strict 5-key PendingFeedPage for PENDING user and hides ineligible posts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/feed?page=1&limit=10')
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual([
      'data',
      'meta',
      'success',
      'timestamp',
    ]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });
    expect(res.body.data).toHaveLength(3);

    const returnedIds = res.body.data.map((item: { id: string }) => item.id);
    expect(returnedIds).toEqual([
      postNewestOtherId,
      postCasioElectronicsId,
      postTextbookBuyId,
    ]);
    expect(returnedIds).not.toContain(postHiddenId);
    expect(returnedIds).not.toContain(postPendingOwnerId);

    for (const item of res.body.data as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual([
        'createdAt',
        'id',
        'postType',
        'thumbnailUrl',
        'title',
      ]);
      expect(item.price).toBeUndefined();
      expect(item.budgetMin).toBeUndefined();
      expect(item.province).toBeUndefined();
      expect(item.owner).toBeUndefined();
    }
  });

  it('AC5: rejects invalid pagination params for PENDING users with 400 VALIDATION_FAILED and details', async () => {
    for (const badQuery of [
      'page=0',
      'page=-1',
      'page=abc',
      'limit=0',
      'limit=101',
    ]) {
      const errRes = await request(app.getHttpServer())
        .get(`/api/v1/feed?${badQuery}`)
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(400);
      expect(errRes.body.error.code).toBe('VALIDATION_FAILED');
      expect(Array.isArray(errRes.body.error.details)).toBe(true);
      expect(errRes.body.error.details.length).toBeGreaterThan(0);
    }
  });

  it('AC4: ADMIN with PENDING verification status receives the full PostPage feed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/feed?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    const first = res.body.data[0] as Record<string, unknown>;
    expect(first.categoryId).toBe('FURNITURE');
    expect(first.price).toBe(320000);
    expect(Object.keys(first)).toContain('province');
    expect(Object.keys(first)).not.toContain('matchedReasons');
  });

  it('AC2: blocks PENDING user from searching/filtering on feed, viewing post details, or interacting', async () => {
    for (const queryString of [
      'q=casio',
      'categoryId=ELECTRONICS',
      'province=H%C3%A0%20N%E1%BB%99i',
      'min=10000',
    ]) {
      const searchRes = await request(app.getHttpServer())
        .get(`/api/v1/feed?${queryString}`)
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(403);
      expect(searchRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    }

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${postCasioElectronicsId}`)
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(403);
    expect(detailRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${pendingToken}`)
      .field('postType', 'BUY_REQUEST')
      .expect(403);
    expect(createRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const revealRes = await request(app.getHttpServer())
      .post(`/api/v1/posts/${postCasioElectronicsId}/reveal-phone`)
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(403);
    expect(revealRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const chatRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ postId: postCasioElectronicsId })
      .expect(403);
    expect(chatRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
  });

  it('AC4: serves newest ACTIVE posts with full PostPage schema and stable pagination for new APPROVED user (Cold-Start)', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/v1/feed?page=1&limit=2')
      .set('Authorization', `Bearer ${coldStartStalePendingToken}`)
      .expect(200);

    expect(page1.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.data[0]).toMatchObject({
      id: postNewestOtherId,
      postType: 'SELL',
      categoryId: 'FURNITURE',
      province: 'Hà Nội',
      status: 'ACTIVE',
      price: 320000,
      budgetMin: null,
      budgetMax: null,
    });
    expect(page1.body.data[0].matchedReasons).toBeUndefined();

    const page2 = await request(app.getHttpServer())
      .get('/api/v1/feed?page=2&limit=2')
      .set('Authorization', `Bearer ${coldStartStalePendingToken}`)
      .expect(200);

    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0]).toMatchObject({
      id: postTextbookBuyId,
      postType: 'BUY_REQUEST',
      price: null,
      budgetMin: 40000,
      budgetMax: 90000,
    });
  });

  it('AC3: ranks personalized feed by preferences + activity history and attaches matchedReasons', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me/preferences')
      .set('Authorization', `Bearer ${personalizedToken}`)
      .send({
        favoriteCategoryIds: ['ELECTRONICS'],
        interestKeywords: ['casio'],
      })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${personalizedToken}`)
      .expect(200);

    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([
      postCasioElectronicsId, // score 4+3+1 = 8
      postTextbookBuyId, // score 2 (conversation activity history)
      postNewestOtherId, // score 0
    ]);

    expect(res.body.data[0].matchedReasons).toEqual([
      FEED_MATCH_REASONS.FAVORITE_CATEGORY,
      FEED_MATCH_REASONS.INTEREST_KEYWORD,
      FEED_MATCH_REASONS.SAME_PROVINCE,
    ]);
    expect(res.body.data[1].matchedReasons).toEqual([
      FEED_MATCH_REASONS.ACTIVITY_HISTORY,
    ]);
    expect(res.body.data[2].matchedReasons).toBeUndefined();
  });

  it('rejects invalid pagination params and unknown query keys for APPROVED users with 400 VALIDATION_FAILED', async () => {
    for (const badQuery of ['page=0', 'page=abc', 'limit=101', 'unknown=1']) {
      const errRes = await request(app.getHttpServer())
        .get(`/api/v1/feed?${badQuery}`)
        .set('Authorization', `Bearer ${approvedSellerToken}`)
        .expect(400);
      expect(errRes.body.error.code).toBe('VALIDATION_FAILED');
    }
  });
});
