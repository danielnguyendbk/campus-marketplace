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
import { ACCESS_TOKEN_JWT, UserRole, VerificationStatus } from '../src/modules/auth/auth.types';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { PostsModule } from '../src/modules/posts/posts.module';

interface FakeUserRecord {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  reputation_score: number;
  province: string | null;
  phone_number?: string | null;
}

class InMemoryPostgresForPosts {
  public users = new Map<string, FakeUserRecord>();
  public categories = [
    { id: 'TEXTBOOK', name: 'Sách và giáo trình', slug: 'textbooks', is_active: true, sort_order: 1 },
    { id: 'ELECTRONICS', name: 'Thiết bị điện tử & Phụ kiện', slug: 'electronics', is_active: true, sort_order: 2 },
    { id: 'FURNITURE', name: 'Nội thất & Đồ dùng phòng trọ', slug: 'furniture', is_active: true, sort_order: 3 },
    { id: 'APPLIANCES', name: 'Đồ gia dụng sinh viên', slug: 'appliances', is_active: true, sort_order: 4 },
    { id: 'OTHER', name: 'Đồ dùng khác', slug: 'other', is_active: true, sort_order: 5 },
  ];
  public posts: Array<Record<string, unknown>> = [];
  public sellDetails = new Map<string, Record<string, unknown>>();
  public buyRequestDetails = new Map<string, Record<string, unknown>>();
  public postImages: Array<Record<string, unknown>> = [];
  public phoneRevealEvents: Array<Record<string, unknown>> = [];

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  async withTransaction<T>(callback: (client: unknown) => Promise<T>): Promise<T> {
    const postsSnapshot = [...this.posts];
    const sellSnapshot = new Map(this.sellDetails);
    const buySnapshot = new Map(this.buyRequestDetails);
    const imagesSnapshot = [...this.postImages];
    try {
      const client = {
        query: async (sql: string, params: unknown[] = []) =>
          this.query(sql, params),
      };
      return await callback(client);
    } catch (err) {
      this.posts = postsSnapshot;
      this.sellDetails = sellSnapshot;
      this.buyRequestDetails = buySnapshot;
      this.postImages = imagesSnapshot;
      throw err;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.includes('FROM "users"') && normalized.includes('WHERE "id" = $1')) {
      const user = this.users.get(String(params[0]));
      return { rows: user ? [user] : [] };
    }

    if (normalized.includes('COUNT(*)::int AS total FROM "categories"')) {
      const active = this.categories.filter((c) => c.is_active);
      return { rows: [{ total: active.length }] };
    }

    if (normalized.includes('FROM "categories"') && normalized.includes('WHERE "id" = $1')) {
      const found = this.categories.find(
        (c) => c.id === params[0] && c.is_active,
      );
      return { rows: found ? [found] : [] };
    }

    if (normalized.includes('FROM "categories"')) {
      const active = this.categories.filter((c) => c.is_active);
      return { rows: active };
    }

    if (normalized.startsWith('INSERT INTO "posts"')) {
      const now = new Date();
      const row = {
        id: randomUUID(),
        owner_id: params[0],
        post_type: params[1],
        title: params[2],
        description: params[3],
        category_id: params[4],
        province: params[5],
        status: 'ACTIVE',
        close_reason: null,
        ended_at: null,
        created_at: now,
        updated_at: now,
      };
      this.posts.push(row);
      return { rows: [row] };
    }

    if (normalized.startsWith('INSERT INTO "sell_details"')) {
      const row = {
        post_id: params[0],
        price: Number(params[1]).toFixed(2),
        condition: params[2],
        allow_phone_reveal: Boolean(params[3]),
      };
      this.sellDetails.set(String(params[0]), row);
      return { rows: [row] };
    }

    if (normalized.startsWith('INSERT INTO "buy_request_details"')) {
      const row = {
        post_id: params[0],
        budget_min: Number(params[1]).toFixed(2),
        budget_max: Number(params[2]).toFixed(2),
      };
      this.buyRequestDetails.set(String(params[0]), row);
      return { rows: [row] };
    }

    if (normalized.startsWith('INSERT INTO "post_images"')) {
      const row = {
        id: randomUUID(),
        post_id: params[0],
        storage_key: params[1],
        sort_order: params[2],
      };
      this.postImages.push(row);
      return { rows: [row] };
    }

    if (normalized.startsWith('INSERT INTO "phone_reveal_events"')) {
      const now = new Date();
      const row = {
        id: randomUUID(),
        viewer_id: params[0],
        post_id: params[1],
        seller_id: params[2],
        revealed_at: now,
      };
      this.phoneRevealEvents.push(row);
      return { rows: [row] };
    }

    if (
      normalized.includes('FROM "posts" p') &&
      normalized.includes('sd."allow_phone_reveal"') &&
      normalized.includes('u."phone_number"')
    ) {
      const post = this.posts.find((p) => p.id === params[0]);
      if (!post) return { rows: [] };
      const owner = this.users.get(String(post.owner_id));
      if (!owner) return { rows: [] };
      const sd = this.sellDetails.get(String(post.id));
      return {
        rows: [
          {
            id: post.id,
            seller_id: post.owner_id,
            post_type: post.post_type,
            status: post.status,
            allow_phone_reveal: sd ? sd.allow_phone_reveal : null,
            phone_number: owner.phone_number ?? null,
          },
        ],
      };
    }

    if (normalized.includes('FROM "posts" p INNER JOIN "users" u')) {
      const post = this.posts.find((p) => p.id === params[0]);
      if (!post) return { rows: [] };
      const owner = this.users.get(String(post.owner_id));
      if (!owner) return { rows: [] };
      const sd = this.sellDetails.get(String(post.id));
      const brd = this.buyRequestDetails.get(String(post.id));
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

    if (normalized.includes('FROM "posts" p LEFT JOIN "sell_details"')) {
      const ownerPosts = this.posts
        .filter((p) => p.owner_id === params[0])
        .map((p) => {
          const sd = this.sellDetails.get(String(p.id));
          const brd = this.buyRequestDetails.get(String(p.id));
          const firstImg = this.postImages
            .filter((img) => img.post_id === p.id)
            .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))[0];
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
            thumbnail_storage_key: firstImg ? firstImg.storage_key : null,
          };
        });
      return { rows: ownerPosts };
    }

    if (normalized.includes('FROM "post_images"')) {
      const imgs = this.postImages
        .filter((img) => img.post_id === params[0])
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      return { rows: imgs };
    }

    if (normalized.includes('COUNT(*)::int AS total FROM "posts" p')) {
      const ownerPosts = this.posts.filter((p) => p.owner_id === params[0]);
      return { rows: [{ total: ownerPosts.length }] };
    }

    if (normalized.startsWith('UPDATE "posts"')) {
      const postId = String(params[1]);
      const post = this.posts.find((p) => p.id === postId);
      if (!post) return { rows: [] };
      post.status = params[0];
      post.updated_at = new Date();
      if (normalized.includes('ended_at')) {
        post.ended_at = new Date();
      }
      if (normalized.includes('close_reason')) {
        post.close_reason = params[params.length - 1];
      }
      return { rows: [post] };
    }

    return { rows: [] };
  }
}

describe('CMP-9 SELL & CMP-10 BUY_REQUEST Post Creation (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const fakeDb = new InMemoryPostgresForPosts();

  const approvedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'approved@student.ptithcm.edu.vn',
    display_name: 'Sinh viên Đã Duyệt',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    phone_number: '0987654321',
  };

  const buyerApprovedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'buyer.approved@student.ptithcm.edu.vn',
    display_name: 'Sinh viên Mua Hàng',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
    phone_number: '0912345678',
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'pending@student.ptithcm.edu.vn',
    display_name: 'Sinh viên Chờ Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: null,
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'suspended@student.ptithcm.edu.vn',
    display_name: 'Sinh viên Bị Khóa',
    role: 'USER',
    verification_status: 'SUSPENDED',
    reputation_score: 1.0,
    province: null,
  };

  const adminUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'admin@student.ptithcm.edu.vn',
    display_name: 'Quản trị viên',
    role: 'ADMIN',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: null,
  };

  let approvedToken: string;
  let buyerToken: string;
  let pendingToken: string;
  let suspendedToken: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    fakeDb.seedUser(approvedUser);
    fakeDb.seedUser(buyerApprovedUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(suspendedUser);
    fakeDb.seedUser(adminUser);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, StorageModule, CategoriesModule, PostsModule],
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

    jwtService = moduleFixture.get<JwtService>(ACCESS_TOKEN_JWT);
    approvedToken = await jwtService.signAsync({
      sub: approvedUser.id,
      email: approvedUser.school_email,
      role: approvedUser.role,
      verificationStatus: approvedUser.verification_status,
      typ: 'access',
    });
    buyerToken = await jwtService.signAsync({
      sub: buyerApprovedUser.id,
      email: buyerApprovedUser.school_email,
      role: buyerApprovedUser.role,
      verificationStatus: buyerApprovedUser.verification_status,
      typ: 'access',
    });
    pendingToken = await jwtService.signAsync({
      sub: pendingUser.id,
      email: pendingUser.school_email,
      role: pendingUser.role,
      verificationStatus: pendingUser.verification_status,
      typ: 'access',
    });
    suspendedToken = await jwtService.signAsync({
      sub: suspendedUser.id,
      email: suspendedUser.school_email,
      role: suspendedUser.role,
      verificationStatus: suspendedUser.verification_status,
      typ: 'access',
    });
    adminToken = await jwtService.signAsync({
      sub: adminUser.id,
      email: adminUser.school_email,
      role: adminUser.role,
      verificationStatus: adminUser.verification_status,
      typ: 'access',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/categories returns active seeded categories in CategoryPage envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 5,
      totalPages: 1,
    });
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([
      'TEXTBOOK',
      'ELECTRONICS',
      'FURNITURE',
      'APPLIANCES',
      'OTHER',
    ]);
  });

  it('AC1: blocks Unauthenticated (401), PENDING (403) and SUSPENDED (403) from creating SELL post', async () => {
    await request(app.getHttpServer()).post('/api/v1/posts').expect(401);

    const pendingRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${pendingToken}`)
      .field('postType', 'SELL')
      .field('title', 'Bàn học')
      .field('description', 'Còn tốt')
      .field('categoryId', 'FURNITURE')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '150000')
      .field('condition', 'Tốt')
      .attach('images', Buffer.from('fake-img'), {
        filename: 'desk.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403);
    expect(pendingRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const suspendedRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Bàn học')
      .field('description', 'Còn tốt')
      .field('categoryId', 'FURNITURE')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '150000')
      .field('condition', 'Tốt')
      .attach('images', Buffer.from('fake-img'), {
        filename: 'desk.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403);
    expect(suspendedRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('AC3: rejects missing images, invalid price, unknown categoryId, and unsupported file type', async () => {
    // Missing images -> 400
    const noImageRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Giáo trình Java')
      .field('description', 'Sách học kỳ 1')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '120000')
      .field('condition', 'Tốt')
      .expect(400);
    expect(noImageRes.body.error.code).toBe('VALIDATION_FAILED');

    // Invalid price (<= 0) -> 400
    await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Giáo trình Java')
      .field('description', 'Sách học kỳ 1')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '0')
      .field('condition', 'Tốt')
      .attach('images', Buffer.from('fake-img'), {
        filename: 'book.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    // Unsupported media type -> 415
    await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Giáo trình Java')
      .field('description', 'Sách học kỳ 1')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '120000')
      .field('condition', 'Tốt')
      .attach('images', Buffer.from('plain-text'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(415);
  });

  it('AC4 & AC5: creates SELL post with status ACTIVE (201) and allows reviewing via GET /posts/:id and GET /me/posts', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Giáo trình Java còn mới')
      .field('description', 'Sách đã sử dụng một học kỳ, không ghi chú')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '120000')
      .field('condition', 'Tốt')
      .field('allowPhoneReveal', 'true')
      .attach('images', Buffer.from('fake-jpeg-1'), {
        filename: 'front.jpg',
        contentType: 'image/jpeg',
      })
      .attach('images', Buffer.from('fake-png-2'), {
        filename: 'back.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(typeof createRes.body.timestamp).toBe('string');

    const created = createRes.body.data;
    expect(created).toMatchObject({
      postType: 'SELL',
      title: 'Giáo trình Java còn mới',
      description: 'Sách đã sử dụng một học kỳ, không ghi chú',
      categoryId: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      sellDetail: {
        price: 120000,
        condition: 'Tốt',
        allowPhoneReveal: true,
      },
      owner: {
        id: approvedUser.id,
        displayName: approvedUser.display_name,
        verificationStatus: 'APPROVED',
        reputationScore: 5,
        province: 'TP. Hồ Chí Minh',
      },
    });
    expect(created.images).toHaveLength(2);
    expect(created.images[0].sortOrder).toBe(0);
    expect(created.images[1].sortOrder).toBe(1);
    expect(created.images[0].url).toMatch(/^http:\/\/localhost:/);
    expect(created.images[0].storageKey).toBeUndefined();
    expect(created.owner.schoolEmail).toBeUndefined();

    // AC5: View created post detail (APPROVED allowed, PENDING blocked with 403)
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', `Bearer ${approvedToken}`)
      .expect(200);
    expect(detailRes.body.data.id).toBe(created.id);
    expect(detailRes.body.data.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(403);

    // AC5: View my posts list
    const myPostsRes = await request(app.getHttpServer())
      .get('/api/v1/me/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .expect(200);

    expect(myPostsRes.body.success).toBe(true);
    expect(myPostsRes.body.data).toHaveLength(1);
    expect(myPostsRes.body.data[0]).toMatchObject({
      id: created.id,
      postType: 'SELL',
      title: 'Giáo trình Java còn mới',
      status: 'ACTIVE',
      price: 120000,
      thumbnailUrl: created.images[0].url,
    });
  });

  it('CMP-10 AC1: blocks Unauthenticated (401), PENDING (403) and SUSPENDED (403) from creating BUY_REQUEST', async () => {
    await request(app.getHttpServer()).post('/api/v1/posts').expect(401);

    const pendingRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${pendingToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .expect(403);
    expect(pendingRes.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');

    const suspendedRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .expect(403);
    expect(suspendedRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('CMP-10 AC2 & AC3: rejects missing budget, negative budgetMin and budgetMax < budgetMin', async () => {
    const missingBudgetRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMax', '150000')
      .expect(400);
    expect(missingBudgetRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(
      missingBudgetRes.body.error.details.map(
        (d: { field: string }) => d.field,
      ),
    ).toContain('budgetMin');

    const negativeBudgetRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '-1000')
      .field('budgetMax', '150000')
      .expect(400);
    expect(negativeBudgetRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(
      negativeBudgetRes.body.error.details.map((d: { field: string }) => d.field),
    ).toContain('budgetMin');

    const invertedBudgetRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '200000')
      .field('budgetMax', '100000')
      .expect(400);
    expect(invertedBudgetRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(invertedBudgetRes.body.error.details).toEqual([
      {
        field: 'budgetMax',
        message: 'budgetMax phải lớn hơn hoặc bằng budgetMin.',
      },
    ]);
  });

  it('CMP-10 AC4: keeps BUY_REQUEST separated from SELL (cross-field rejection, 201 with buyRequestDetail, no images)', async () => {
    const buyWithPriceRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .field('price', '120000')
      .expect(400);
    expect(buyWithPriceRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(buyWithPriceRes.body.error.details[0].field).toBe('price');

    const buyWithConditionRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .field('condition', 'Tốt')
      .expect(400);
    expect(buyWithConditionRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(buyWithConditionRes.body.error.details[0].field).toBe('condition');

    const buyWithAllowPhoneRevealRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua giáo trình Java')
      .field('description', 'Cần sách để học')
      .field('categoryId', 'TEXTBOOK')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .field('allowPhoneReveal', 'true')
      .expect(400);
    expect(buyWithAllowPhoneRevealRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(buyWithAllowPhoneRevealRes.body.error.details[0].field).toBe(
      'allowPhoneReveal',
    );

    const sellWithBudgetRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'SELL')
      .field('title', 'Bàn học sinh viên')
      .field('description', 'Bàn gấp gọn còn tốt')
      .field('categoryId', 'FURNITURE')
      .field('province', 'TP. Hồ Chí Minh')
      .field('price', '150000')
      .field('condition', 'Tốt')
      .field('budgetMin', '100000')
      .expect(400);
    expect(sellWithBudgetRes.body.error.code).toBe('VALIDATION_FAILED');
    expect(
      sellWithBudgetRes.body.error.details.map(
        (d: { field: string }) => d.field,
      ),
    ).toContain('budgetMin');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .field('postType', 'BUY_REQUEST')
      .field('title', 'Tìm mua máy tính Casio FX-580')
      .field('description', 'Cần máy tính cho môn Toán cao cấp')
      .field('categoryId', 'ELECTRONICS')
      .field('province', 'TP. Hồ Chí Minh')
      .field('budgetMin', '100000')
      .field('budgetMax', '150000')
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(typeof createRes.body.timestamp).toBe('string');

    const created = createRes.body.data;
    expect(created).toMatchObject({
      postType: 'BUY_REQUEST',
      title: 'Tìm mua máy tính Casio FX-580',
      description: 'Cần máy tính cho môn Toán cao cấp',
      categoryId: 'ELECTRONICS',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      buyRequestDetail: {
        budgetMin: 100000,
        budgetMax: 150000,
      },
      owner: {
        id: approvedUser.id,
        displayName: approvedUser.display_name,
        verificationStatus: 'APPROVED',
        reputationScore: 5,
        province: 'TP. Hồ Chí Minh',
      },
    });
    expect(created.images).toEqual([]);
    expect(created.sellDetail).toBeUndefined();
    expect(created.owner.schoolEmail).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain('storageKey');

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', `Bearer ${approvedToken}`)
      .expect(200);
    expect(detailRes.body.data.postType).toBe('BUY_REQUEST');
    expect(detailRes.body.data.buyRequestDetail).toEqual({
      budgetMin: 100000,
      budgetMax: 150000,
    });
    expect(detailRes.body.data.sellDetail).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/v1/posts/${created.id}`)
      .set('Authorization', `Bearer ${pendingToken}`)
      .expect(403);
  });

  it('CMP-10 AC5: lists BUY_REQUEST and SELL posts distinctly in GET /me/posts', async () => {
    const myPostsRes = await request(app.getHttpServer())
      .get('/api/v1/me/posts')
      .set('Authorization', `Bearer ${approvedToken}`)
      .expect(200);

    expect(myPostsRes.body.success).toBe(true);
    expect(myPostsRes.body.meta.total).toBe(2);

    const buyRequestRow = myPostsRes.body.data.find(
      (p: { postType: string }) => p.postType === 'BUY_REQUEST',
    );
    expect(buyRequestRow).toMatchObject({
      postType: 'BUY_REQUEST',
      title: 'Tìm mua máy tính Casio FX-580',
      status: 'ACTIVE',
      price: null,
      budgetMin: 100000,
      budgetMax: 150000,
      thumbnailUrl: null,
    });

    const sellRow = myPostsRes.body.data.find(
      (p: { postType: string }) => p.postType === 'SELL',
    );
    expect(sellRow).toMatchObject({
      postType: 'SELL',
      price: 120000,
      budgetMin: null,
      budgetMax: null,
    });
  });

  describe('CMP-17: Controlled Phone Reveal Flow (e2e)', () => {
    let sellPostWithPhoneId: string;
    let sellPostWithoutPhoneId: string;
    let buyRequestPostId: string;

    beforeAll(async () => {
      // 1. Tạo 1 SELL post cho phép reveal phone
      const sellWithPhoneRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${approvedToken}`)
        .field('postType', 'SELL')
        .field('title', 'Sách giải tích 1 còn mới')
        .field('description', 'Sách bìa mềm')
        .field('categoryId', 'TEXTBOOK')
        .field('province', 'TP. Hồ Chí Minh')
        .field('price', '45000')
        .field('condition', 'Tốt')
        .field('allowPhoneReveal', 'true')
        .attach('images', Buffer.from('fake-image-bytes-1'), {
          filename: 'book1.png',
          contentType: 'image/png',
        })
        .expect(201);
      sellPostWithPhoneId = sellWithPhoneRes.body.data.id;

      // 2. Tạo 1 SELL post TẮT allowPhoneReveal
      const sellWithoutPhoneRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${approvedToken}`)
        .field('postType', 'SELL')
        .field('title', 'Sách vật lý đại cương')
        .field('description', 'Sách bìa cứng')
        .field('categoryId', 'TEXTBOOK')
        .field('province', 'TP. Hồ Chí Minh')
        .field('price', '60000')
        .field('condition', 'Như mới')
        .field('allowPhoneReveal', 'false')
        .attach('images', Buffer.from('fake-image-bytes-2'), {
          filename: 'book2.png',
          contentType: 'image/png',
        })
        .expect(201);
      sellPostWithoutPhoneId = sellWithoutPhoneRes.body.data.id;

      // 3. Tạo 1 BUY_REQUEST post
      const buyRequestRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${approvedToken}`)
        .field('postType', 'BUY_REQUEST')
        .field('title', 'Tìm mua bàn học gấp')
        .field('description', 'Bàn gấp sinh viên')
        .field('categoryId', 'FURNITURE')
        .field('province', 'TP. Hồ Chí Minh')
        .field('budgetMin', '50000')
        .field('budgetMax', '100000')
        .expect(201);
      buyRequestPostId = buyRequestRes.body.data.id;
    });

    it('CMP-17 AC1: APPROVED buyer reveals phone on active SELL post with allowPhoneReveal=true', async () => {
      const initialEventCount = fakeDb.phoneRevealEvents.length;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithPhoneId}/reveal-phone`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        phoneNumber: '0987654321',
      });
      expect(typeof res.body.data.revealedAt).toBe('string');
      expect(new Date(res.body.data.revealedAt).getTime()).not.toBeNaN();
      expect(res.body.timestamp).toBeDefined();

      // Kiểm tra sự kiện đã được lưu vào database
      expect(fakeDb.phoneRevealEvents.length).toBe(initialEventCount + 1);
      const recordedEvent = fakeDb.phoneRevealEvents[fakeDb.phoneRevealEvents.length - 1];
      expect(recordedEvent.viewer_id).toBe(buyerApprovedUser.id);
      expect(recordedEvent.post_id).toBe(sellPostWithPhoneId);
      expect(recordedEvent.seller_id).toBe(approvedUser.id);
    });

    it('CMP-17 AC2: APPROVED buyer reveals phone on SELL post with allowPhoneReveal=false (returns null phoneNumber, records event)', async () => {
      const initialEventCount = fakeDb.phoneRevealEvents.length;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithoutPhoneId}/reveal-phone`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneNumber).toBeNull();
      expect(typeof res.body.data.revealedAt).toBe('string');

      // Vẫn phải ghi nhận sự kiện vào database để phục vụ điều kiện báo cáo BR-11/BR-13
      expect(fakeDb.phoneRevealEvents.length).toBe(initialEventCount + 1);
      const recordedEvent = fakeDb.phoneRevealEvents[fakeDb.phoneRevealEvents.length - 1];
      expect(recordedEvent.viewer_id).toBe(buyerApprovedUser.id);
      expect(recordedEvent.post_id).toBe(sellPostWithoutPhoneId);
    });

    it('CMP-17 AC3: Owner viewing own post receives phone number even if allowPhoneReveal=false', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithoutPhoneId}/reveal-phone`)
        .set('Authorization', `Bearer ${approvedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneNumber).toBe('0987654321');
    });

    it('CMP-17 AC4: PENDING user receives 403 ACCOUNT_NOT_VERIFIED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithPhoneId}/reveal-phone`)
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('CMP-17 AC5: Unauthenticated request receives 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithPhoneId}/reveal-phone`)
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('CMP-17 AC6: Requesting reveal-phone on BUY_REQUEST post returns 409 INVALID_POST_TYPE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${buyRequestPostId}/reveal-phone`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_POST_TYPE');
    });

    it('CMP-17 AC7: Non-existent post returns 404 POST_NOT_FOUND', async () => {
      const randomPostId = randomUUID();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${randomPostId}/reveal-phone`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('POST_NOT_FOUND');
    });

    it('CMP-17 AC8: Invalid UUID format in URL path returns 400 VALIDATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/posts/not-a-valid-uuid/reveal-phone')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'id' }),
        ]),
      );
    });

    it('CMP-17 AC9: Strict OpenAPI envelope adherence for PhoneRevealResponse', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${sellPostWithPhoneId}/reveal-phone`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // OpenAPI schema: PhoneRevealResponse có success, data, timestamp; additionalProperties: false
      const keys = Object.keys(res.body);
      expect(keys.sort()).toEqual(['data', 'success', 'timestamp'].sort());
      expect(res.body.success).toBe(true);

      // Data keys: phoneNumber, revealedAt; additionalProperties: false
      const dataKeys = Object.keys(res.body.data);
      expect(dataKeys.sort()).toEqual(['phoneNumber', 'revealedAt'].sort());
    });
  });

  describe('CMP-10 & CMP-11: Post Lifecycle State Transitions (e2e)', () => {
    let testSellPostId: string;
    let testBuyPostId: string;

    beforeAll(async () => {
      // Tạo một bài SELL để kiểm thử lifecycle
      const sellRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${approvedToken}`)
        .field('postType', 'SELL')
        .field('title', 'Bàn học sinh viên gấp gọn gỗ cao su')
        .field('description', 'Bàn gấp gọn còn mới 95% chuyển trọ cần thanh lý')
        .field('categoryId', 'FURNITURE')
        .field('province', 'TP. Hồ Chí Minh')
        .field('price', '250000')
        .field('condition', 'LIKE_NEW')
        .attach('images', Buffer.from('FAKE_IMAGE_BYTES_1'), 'ban_hoc.jpg')
        .expect(201);
      testSellPostId = sellRes.body.data.id;

      // Tạo một bài BUY_REQUEST để kiểm thử lifecycle
      const buyRes = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${approvedToken}`)
        .field('postType', 'BUY_REQUEST')
        .field('title', 'Tìm mua máy tính Casio fx-580VN X')
        .field('description', 'Cần mua máy tính casio fx-580 cũ cho kỳ thi')
        .field('categoryId', 'ELECTRONICS')
        .field('province', 'TP. Hồ Chí Minh')
        .field('budgetMin', '200000')
        .field('budgetMax', '400000')
        .expect(201);
      testBuyPostId = buyRes.body.data.id;
    });

    describe('POST /api/v1/posts/:id/hide', () => {
      it('AC1: Owner can hide ACTIVE post (ACTIVE -> HIDDEN)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(testSellPostId);
        expect(res.body.data.status).toBe('HIDDEN');
      });

      it('AC2: Outsider receives 403 FORBIDDEN when attempting to hide another user post', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(403);

        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('AC3: Calling hide on an already HIDDEN post returns 409 POST_ALREADY_HIDDEN', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_ALREADY_HIDDEN');
      });

      it('AC4: Unauthenticated user receives 401 UNAUTHORIZED', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .expect(401);
      });

      it('AC5: PENDING user receives 403 ACCOUNT_NOT_VERIFIED', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${pendingToken}`)
          .expect(403);

        expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
      });
    });

    describe('POST /api/v1/posts/:id/activate', () => {
      it('AC6: Owner can activate HIDDEN post (HIDDEN -> ACTIVE)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/activate`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ACTIVE');
      });

      it('AC7: Outsider receives 403 FORBIDDEN when attempting to activate another user post', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/activate`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(403);

        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('AC8: Calling activate on an already ACTIVE post returns 409 POST_ALREADY_ACTIVE', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/activate`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_ALREADY_ACTIVE');
      });

      it('AC9: ADMIN can activate a post', async () => {
        // Owner ẩn trước
        await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(200);

        // Admin mở lại
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/activate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ACTIVE');
      });
    });

    describe('POST /api/v1/posts/:id/sold', () => {
      it('AC10: Reject marking BUY_REQUEST as SOLD (409 INVALID_POST_TYPE)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testBuyPostId}/sold`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('INVALID_POST_TYPE');
      });

      it('AC11: Owner marks SELL post as SOLD successfully (ACTIVE -> SOLD)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/sold`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('SOLD');
        expect(res.body.data.endedAt).toBeDefined();
      });

      it('AC12: Calling sold on an already SOLD post returns 409 POST_ALREADY_SOLD', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/sold`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_ALREADY_SOLD');
      });

      it('AC13: Terminal state: SOLD post cannot be reactivated (409 POST_TERMINATED)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/activate`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_TERMINATED');
      });

      it('AC14: Terminal state: SOLD post cannot be hidden (409 POST_TERMINATED)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testSellPostId}/hide`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_TERMINATED');
      });
    });

    describe('POST /api/v1/posts/:id/close', () => {
      it('AC15: Owner closes BUY_REQUEST post successfully with reason', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testBuyPostId}/close`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .send({ reason: 'Đã mua được máy tính từ bạn cùng phòng' })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('CLOSED');
        expect(res.body.data.closeReason).toBe('Đã mua được máy tính từ bạn cùng phòng');
        expect(res.body.data.endedAt).toBeDefined();
      });

      it('AC16: Reject empty reason with 400 VALIDATION_FAILED', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testBuyPostId}/close`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .send({ reason: '   ' })
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('AC17: Calling close on an already CLOSED post returns 409 POST_ALREADY_CLOSED', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testBuyPostId}/close`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .send({ reason: 'Đóng lần 2' })
          .expect(409);

        expect(res.body.error.code).toBe('POST_ALREADY_CLOSED');
      });

      it('AC18: Terminal state: CLOSED post cannot be reactivated (409 POST_TERMINATED)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${testBuyPostId}/activate`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(409);

        expect(res.body.error.code).toBe('POST_TERMINATED');
      });

      it('AC19: Strict envelope check for PostResponse on lifecycle transitions', async () => {
        const newPost = await request(app.getHttpServer())
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${approvedToken}`)
          .field('postType', 'SELL')
          .field('title', 'Sách giải tích 2')
          .field('description', 'Sách mới')
          .field('categoryId', 'TEXTBOOK')
          .field('province', 'TP. Hồ Chí Minh')
          .field('price', '50000')
          .field('condition', 'LIKE_NEW')
          .attach('images', Buffer.from('FAKE_BYTES'), 'gt2.jpg')
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/posts/${newPost.body.data.id}/hide`)
          .set('Authorization', `Bearer ${approvedToken}`)
          .expect(200);

        expect(Object.keys(res.body).sort()).toEqual(['data', 'success', 'timestamp'].sort());
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('HIDDEN');
      });
    });
  });
});
