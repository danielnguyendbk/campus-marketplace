import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { DatabaseModule } from '../src/database/database.module';
import { PostgresService } from '../src/database/postgres.service';
import { ACCESS_TOKEN_JWT, UserRole, VerificationStatus } from '../src/modules/auth/auth.types';
import { ChatModule } from '../src/modules/chat/chat.module';

interface FakeUserRecord {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  reputation_score: number;
  province: string | null;
}

interface FakePostRecord {
  id: string;
  owner_id: string;
  post_type: 'SELL' | 'BUY_REQUEST';
  title: string;
  status: 'ACTIVE' | 'HIDDEN' | 'SOLD' | 'CLOSED';
}

interface FakeConversationRecord {
  id: string;
  post_id: string;
  member_low_id: string;
  member_high_id: string;
  status: 'OPEN' | 'ARCHIVED';
  last_message_at: Date | null;
  created_at: Date;
}

class InMemoryPostgresForChat {
  public users = new Map<string, FakeUserRecord>();
  public posts = new Map<string, FakePostRecord>();
  public conversations: FakeConversationRecord[] = [];

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  seedPost(post: FakePostRecord) {
    this.posts.set(post.id, post);
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.includes('FROM "users"') && normalized.includes('WHERE "id" = $1')) {
      const user = this.users.get(String(params[0]));
      return { rows: user ? [user] : [] };
    }

    if (normalized.includes('FROM "posts" p') && normalized.includes('p."owner_id" AS "seller_id"')) {
      const post = this.posts.get(String(params[0]));
      if (!post) return { rows: [] };
      const seller = this.users.get(post.owner_id);
      if (!seller) return { rows: [] };
      return {
        rows: [
          {
            id: post.id,
            seller_id: post.owner_id,
            post_type: post.post_type,
            status: post.status,
            seller_verification_status: seller.verification_status,
          },
        ],
      };
    }

    if (normalized.startsWith('INSERT INTO "conversations"')) {
      const postId = String(params[0]);
      const lowId = String(params[1]);
      const highId = String(params[2]);

      const existing = this.conversations.find(
        (c) => c.post_id === postId && c.member_low_id === lowId && c.member_high_id === highId,
      );

      if (existing) {
        return { rows: [existing] };
      }

      const row: FakeConversationRecord = {
        id: randomUUID(),
        post_id: postId,
        member_low_id: lowId,
        member_high_id: highId,
        status: 'OPEN',
        last_message_at: null,
        created_at: new Date(),
      };
      this.conversations.push(row);
      return { rows: [row] };
    }

    if (normalized.includes('FROM "users" u') && normalized.includes('WHERE u."id" = ANY($1::uuid[])')) {
      const ids = params[0] as string[];
      const matched = ids
        .map((id) => this.users.get(id))
        .filter((u): u is FakeUserRecord => !!u)
        .map((u) => ({
          id: u.id,
          display_name: u.display_name,
          verification_status: u.verification_status,
          reputation_score: u.reputation_score,
          province: u.province,
        }));
      return { rows: matched };
    }

    if (normalized.includes('COUNT(*)::int AS total') && normalized.includes('FROM "conversations" c')) {
      const userId = String(params[0]);
      const count = this.conversations.filter(
        (c) => c.member_low_id === userId || c.member_high_id === userId,
      ).length;
      return { rows: [{ total: count }] };
    }

    if (normalized.includes('FROM "conversations" c') && normalized.includes('ORDER BY c."last_message_at"')) {
      const userId = String(params[0]);
      const limit = Number(params[1]);
      const offset = Number(params[2]);

      const filtered = this.conversations
        .filter((c) => c.member_low_id === userId || c.member_high_id === userId)
        .map((c) => {
          const post = this.posts.get(c.post_id);
          const uLow = this.users.get(c.member_low_id);
          const uHigh = this.users.get(c.member_high_id);
          return {
            id: c.id,
            post_id: c.post_id,
            member_low_id: c.member_low_id,
            member_high_id: c.member_high_id,
            status: c.status,
            last_message_at: c.last_message_at,
            created_at: c.created_at,
            post_status: post?.status ?? 'ACTIVE',
            post_type: post?.post_type ?? 'SELL',
            low_id: uLow?.id ?? c.member_low_id,
            low_display_name: uLow?.display_name ?? 'Low',
            low_verification_status: uLow?.verification_status ?? 'APPROVED',
            low_reputation_score: uLow?.reputation_score ?? 5.0,
            low_province: uLow?.province ?? null,
            high_id: uHigh?.id ?? c.member_high_id,
            high_display_name: uHigh?.display_name ?? 'High',
            high_verification_status: uHigh?.verification_status ?? 'APPROVED',
            high_reputation_score: uHigh?.reputation_score ?? 5.0,
            high_province: uHigh?.province ?? null,
          };
        })
        .slice(offset, offset + limit);

      return { rows: filtered };
    }

    return { rows: [] };
  }
}

describe('CMP-15: Conversations Management & Access Boundaries (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const fakeDb = new InMemoryPostgresForChat();

  const sellerUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'seller@student.ptithcm.edu.vn',
    display_name: 'Người Bán Thẻ Xanh',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 4.8,
    province: 'TP. Hồ Chí Minh',
  };

  const buyerUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'buyer@student.ptithcm.edu.vn',
    display_name: 'Người Mua Thẻ Xanh',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'Hà Nội',
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

  const activeSellPost: FakePostRecord = {
    id: randomUUID(),
    owner_id: sellerUser.id,
    post_type: 'SELL',
    title: 'Giáo trình Giải tích 1',
    status: 'ACTIVE',
  };

  const soldSellPost: FakePostRecord = {
    id: randomUUID(),
    owner_id: sellerUser.id,
    post_type: 'SELL',
    title: 'Giáo trình Vật lý 1 đã bán',
    status: 'SOLD',
  };

  const buyRequestPost: FakePostRecord = {
    id: randomUUID(),
    owner_id: sellerUser.id,
    post_type: 'BUY_REQUEST',
    title: 'Cần mua bàn học',
    status: 'ACTIVE',
  };

  let buyerToken: string;
  let sellerToken: string;
  let pendingToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    fakeDb.seedUser(sellerUser);
    fakeDb.seedUser(buyerUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedPost(activeSellPost);
    fakeDb.seedPost(soldSellPost);
    fakeDb.seedPost(buyRequestPost);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, ChatModule],
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
    sellerToken = await jwtService.signAsync({
      sub: sellerUser.id,
      email: sellerUser.school_email,
      role: sellerUser.role,
      verificationStatus: sellerUser.verification_status,
      typ: 'access',
    });
    buyerToken = await jwtService.signAsync({
      sub: buyerUser.id,
      email: buyerUser.school_email,
      role: buyerUser.role,
      verificationStatus: buyerUser.verification_status,
      typ: 'access',
    });
    pendingToken = await jwtService.signAsync({
      sub: pendingUser.id,
      email: pendingUser.school_email,
      role: pendingUser.role,
      verificationStatus: pendingUser.verification_status,
      typ: 'access',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/conversations', () => {
    let createdConvId: string;

    it('CMP-15 AC1: APPROVED buyer creates conversation with seller on active SELL post (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        postId: activeSellPost.id,
        status: 'OPEN',
        canSend: true,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.members).toHaveLength(2);
      createdConvId = res.body.data.id;
    });

    it('CMP-15 AC2: Idempotent - creating again returns the same existing conversation (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdConvId);
      expect(res.body.data.postId).toBe(activeSellPost.id);
    });

    it('CMP-15 AC3: Seller cannot create conversation with self (400 SELF_CONVERSATION_NOT_ALLOWED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(400);

      expect(res.body.error.code).toBe('SELF_CONVERSATION_NOT_ALLOWED');
    });

    it('CMP-15 AC4: Unauthenticated request receives 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .send({ postId: activeSellPost.id })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('CMP-15 AC5: PENDING user receives 403 ACCOUNT_NOT_VERIFIED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({ postId: activeSellPost.id })
        .expect(403);

      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('CMP-15 AC6: Post is BUY_REQUEST returns 409 INVALID_POST_TYPE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: buyRequestPost.id })
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_POST_TYPE');
    });

    it('CMP-15 AC7: Post is SOLD returns 409 POST_NOT_ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: soldSellPost.id })
        .expect(409);

      expect(res.body.error.code).toBe('POST_NOT_ACTIVE');
    });

    it('CMP-15 AC8: Post not found returns 404 POST_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: randomUUID() })
        .expect(404);

      expect(res.body.error.code).toBe('POST_NOT_FOUND');
    });

    it('CMP-15 AC9: Invalid UUID format returns 400 VALIDATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: 'not-a-uuid' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'postId' })]),
      );
    });

    it('CMP-15 AC10: Strict OpenAPI envelope validation for ConversationResponse', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      // Success envelope: [success, data, timestamp]
      const envelopeKeys = Object.keys(res.body);
      expect(envelopeKeys.sort()).toEqual(['data', 'success', 'timestamp'].sort());

      // Data schema keys: [id, postId, status, members, createdAt, canSend] (+ optional lastMessageAt)
      const dataKeys = Object.keys(res.body.data);
      expect(dataKeys).toEqual(
        expect.arrayContaining(['id', 'postId', 'status', 'members', 'createdAt', 'canSend']),
      );
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('returns user conversations in paginated ConversationPage envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations?page=1&limit=10')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      // Strict envelope keys
      expect(Object.keys(res.body).sort()).toEqual(['data', 'meta', 'success', 'timestamp'].sort());
    });

    it('seller also sees the conversation in their own list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.meta.total).toBe(1);
    });

    it('blocks PENDING users from listing conversations (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${pendingToken}`)
        .expect(403);
    });

    it('blocks Unauthenticated users from listing conversations (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .expect(401);
    });
  });
});
