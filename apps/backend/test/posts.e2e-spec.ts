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

  let approvedToken: string;
  let pendingToken: string;
  let suspendedToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    fakeDb.seedUser(approvedUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(suspendedUser);

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
});
