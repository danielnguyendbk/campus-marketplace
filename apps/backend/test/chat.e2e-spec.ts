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

interface FakeMessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'TEXT' | 'ATTACHMENT';
  content: string | null;
  created_at: Date;
  expires_at: Date;
}

interface FakeAttachmentRecord {
  id: string;
  message_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  expires_at: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'DELETED';
}

class InMemoryPostgresForChat {
  public users = new Map<string, FakeUserRecord>();
  public posts = new Map<string, FakePostRecord>();
  public conversations: FakeConversationRecord[] = [];
  public messages: FakeMessageRecord[] = [];
  public attachments: FakeAttachmentRecord[] = [];

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  seedPost(post: FakePostRecord) {
    this.posts.set(post.id, post);
  }

  async withTransaction<T>(callback: (client: unknown) => Promise<T>): Promise<T> {
    return callback(this);
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

    // Context for message operations
    if (normalized.includes('FROM "conversations" c') && normalized.includes('JOIN "posts" p') && normalized.includes('WHERE c.id = $1')) {
      const convId = String(params[0]);
      const conv = this.conversations.find((c) => c.id === convId);
      if (!conv) return { rows: [] };

      const post = this.posts.get(conv.post_id);
      const uLow = this.users.get(conv.member_low_id);
      const uHigh = this.users.get(conv.member_high_id);

      return {
        rows: [
          {
            id: conv.id,
            post_id: conv.post_id,
            member_low_id: conv.member_low_id,
            member_high_id: conv.member_high_id,
            status: conv.status,
            post_owner_id: post?.owner_id ?? 'unknown',
            post_status: post?.status ?? 'ACTIVE',
            post_type: post?.post_type ?? 'SELL',
            member_low_status: uLow?.verification_status ?? 'APPROVED',
            member_high_status: uHigh?.verification_status ?? 'APPROVED',
          },
        ],
      };
    }

    if (normalized.startsWith('INSERT INTO "messages"')) {
      const convId = String(params[0]);
      const senderId = String(params[1]);
      const type = (normalized.includes("'TEXT'") ? 'TEXT' : 'ATTACHMENT') as 'TEXT' | 'ATTACHMENT';
      const content = type === 'TEXT' ? String(params[2]) : null;

      const row: FakeMessageRecord = {
        id: randomUUID(),
        conversation_id: convId,
        sender_id: senderId,
        type,
        content,
        created_at: new Date(),
        expires_at:
          type === 'TEXT'
            ? new Date(Date.now() + 90 * 86400000)
            : new Date(Date.now() + 30 * 86400000),
      };
      this.messages.push(row);
      return { rows: [row] };
    }

    if (normalized.startsWith('INSERT INTO "attachments"')) {
      const msgId = String(params[0]);
      const storageKey = String(params[1]);
      const mimeType = String(params[2]);
      const sizeBytes = Number(params[3]);

      const row: FakeAttachmentRecord = {
        id: randomUUID(),
        message_id: msgId,
        storage_key: storageKey,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        expires_at: new Date(Date.now() + 30 * 86400000),
        status: 'ACTIVE',
      };
      this.attachments.push(row);
      return { rows: [row] };
    }

    if (normalized.startsWith('UPDATE "conversations" SET "last_message_at"')) {
      const convId = String(params[0]);
      const conv = this.conversations.find((c) => c.id === convId);
      if (conv) {
        conv.last_message_at = new Date();
      }
      return { rows: [] };
    }

    if (normalized.includes('FROM "messages" m') && normalized.includes('LEFT JOIN "attachments" a')) {
      const convId = String(params[0]);
      const limit = Number(params[1]);
      const offset = Number(params[2]);

      const rows = this.messages
        .filter((m) => m.conversation_id === convId)
        .slice(offset, offset + limit)
        .map((m) => {
          const att = this.attachments.find((a) => a.message_id === m.id);
          return {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            type: m.type,
            content: m.content,
            created_at: m.created_at,
            expires_at: m.expires_at,
            attachment_id: att?.id ?? null,
            attachment_storage_key: att?.storage_key ?? null,
            attachment_mime_type: att?.mime_type ?? null,
            attachment_size_bytes: att?.size_bytes ?? null,
            attachment_expires_at: att?.expires_at ?? null,
            attachment_status: att?.status ?? null,
          };
        });

      return { rows };
    }

    if (normalized.includes('COUNT(*)::int AS count FROM "messages"')) {
      const convId = String(params[0]);
      const count = this.messages.filter((m) => m.conversation_id === convId).length;
      return { rows: [{ count }] };
    }

    if (normalized.includes('FROM "attachments" a') && normalized.includes('JOIN "messages" m')) {
      const attId = String(params[0]);
      const convId = String(params[1]);
      const att = this.attachments.find((a) => a.id === attId);
      if (!att) return { rows: [] };

      const msg = this.messages.find((m) => m.id === att.message_id && m.conversation_id === convId);
      if (!msg) return { rows: [] };

      return {
        rows: [
          {
            id: att.id,
            message_id: att.message_id,
            storage_key: att.storage_key,
            mime_type: att.mime_type,
            size_bytes: att.size_bytes,
            expires_at: att.expires_at,
            status: att.status,
            conversation_id: convId,
          },
        ],
      };
    }

    return { rows: [] };
  }
}

describe('CMP-15 & CMP-16: Chat Domain (Conversations, Messages, Attachments) (e2e)', () => {
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
    province: 'Hà Nội',
  };

  const buyerUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'buyer@student.ptithcm.edu.vn',
    display_name: 'Người Mua Thẻ Xanh',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 5.0,
    province: 'TP. Hồ Chí Minh',
  };

  const outsiderUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'outsider@student.ptithcm.edu.vn',
    display_name: 'Người Ngoài Cuộc',
    role: 'USER',
    verification_status: 'APPROVED',
    reputation_score: 4.2,
    province: 'Đà Nẵng',
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'pending@student.ptithcm.edu.vn',
    display_name: 'Sinh Viên Chờ Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
    reputation_score: 5.0,
    province: null,
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'suspended@student.ptithcm.edu.vn',
    display_name: 'Sinh Viên Bị Khóa',
    role: 'USER',
    verification_status: 'SUSPENDED',
    reputation_score: 1.0,
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
    title: 'Máy tính Casio fx-580VNX (Đã bán)',
    status: 'SOLD',
  };

  const buyRequestPost: FakePostRecord = {
    id: randomUUID(),
    owner_id: sellerUser.id,
    post_type: 'BUY_REQUEST',
    title: 'Cần mua bàn học gấp',
    status: 'ACTIVE',
  };

  let sellerToken: string;
  let buyerToken: string;
  let outsiderToken: string;
  let pendingToken: string;
  let suspendedToken: string;

  beforeAll(async () => {
    fakeDb.seedUser(sellerUser);
    fakeDb.seedUser(buyerUser);
    fakeDb.seedUser(outsiderUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(suspendedUser);

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
    sellerToken = jwtService.sign({
      sub: sellerUser.id,
      email: sellerUser.school_email,
      role: sellerUser.role,
      verificationStatus: sellerUser.verification_status,
      typ: 'access',
    });
    buyerToken = jwtService.sign({
      sub: buyerUser.id,
      email: buyerUser.school_email,
      role: buyerUser.role,
      verificationStatus: buyerUser.verification_status,
      typ: 'access',
    });
    outsiderToken = jwtService.sign({
      sub: outsiderUser.id,
      email: outsiderUser.school_email,
      role: outsiderUser.role,
      verificationStatus: outsiderUser.verification_status,
      typ: 'access',
    });
    pendingToken = jwtService.sign({
      sub: pendingUser.id,
      email: pendingUser.school_email,
      role: pendingUser.role,
      verificationStatus: pendingUser.verification_status,
      typ: 'access',
    });
    suspendedToken = jwtService.sign({
      sub: suspendedUser.id,
      email: suspendedUser.school_email,
      role: suspendedUser.role,
      verificationStatus: suspendedUser.verification_status,
      typ: 'access',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Part 1: CMP-15 Conversations Management', () => {
    it('creates a new conversation between buyer and seller', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.postId).toBe(activeSellPost.id);
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.canSend).toBe(true);
      expect(res.body.data.members).toHaveLength(2);
    });

    it('returns the same conversation (idempotent)', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);

      expect(res1.body.data.id).toBe(res2.body.data.id);
    });

    it('blocks self-conversation (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(400);

      expect(res.body.error.code).toBe('SELF_CONVERSATION_NOT_ALLOWED');
    });

    it('rejects BUY_REQUEST posts (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: buyRequestPost.id })
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_POST_TYPE');
    });

    it('rejects SOLD posts (409)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: soldSellPost.id })
        .expect(409);

      expect(res.body.error.code).toBe('POST_NOT_ACTIVE');
    });

    it('returns user conversations in paginated ConversationPage envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations?page=1&limit=10')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('Part 2: CMP-16 Messages & Attachments Handling', () => {
    let createdConvId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ postId: activeSellPost.id })
        .expect(201);
      createdConvId = res.body.data.id;
    });

    describe('POST /api/v1/conversations/:id/messages (Text Message)', () => {
      it('AC1: Sends text message successfully with MessageResponse envelope', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ content: 'Chào bạn, sách còn mới không ạ?' })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
          conversationId: createdConvId,
          senderId: buyerUser.id,
          type: 'TEXT',
          content: 'Chào bạn, sách còn mới không ạ?',
        });
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.createdAt).toBeDefined();
        expect(res.body.data.expiresAt).toBeDefined();

        // Strict envelope additionalProperties: false check
        expect(Object.keys(res.body).sort()).toEqual(['data', 'success', 'timestamp'].sort());
      });

      it('AC2: Seller can reply in the same conversation', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${sellerToken}`)
          .send({ content: 'Sách mới 95% bạn nha, không quăn mép.' })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.senderId).toBe(sellerUser.id);
      });

      it('AC3: Blocks outsider from sending message to another conversation (403)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({ content: 'Tôi muốn chen ngang vào chat' })
          .expect(403);

        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('AC4: Blocks unauthenticated user from sending message (401)', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .send({ content: 'Không có token' })
          .expect(401);
      });

      it('AC5: Blocks PENDING student from sending message (403)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${pendingToken}`)
          .send({ content: 'Em chưa được duyệt thẻ' })
          .expect(403);

        expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
      });

      it('Blocks SUSPENDED student from sending message (403)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${suspendedToken}`)
          .send({ content: 'Em bị khóa tài khoản' })
          .expect(403);

        expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
      });

      it('AC6: Rejects empty or blank content (400)', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ content: '    ' })
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('AC7: Returns 404 when conversation ID does not exist', async () => {
        const nonExistentId = randomUUID();
        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${nonExistentId}/messages`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ content: 'Hello' })
          .expect(404);

        expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND');
      });
    });

    describe('GET /api/v1/conversations/:id/messages (List Messages)', () => {
      it('AC8: Returns paginated messages with MessagePage schema', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/conversations/${createdConvId}/messages?page=1&limit=10`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(2);
        expect(res.body.meta).toMatchObject({
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        });

        // Strict envelope keys check
        expect(Object.keys(res.body).sort()).toEqual(['data', 'meta', 'success', 'timestamp'].sort());
      });

      it('AC9: Blocks outsider from viewing conversation messages (403)', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .expect(403);

        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('AC10: Masks expired message content to null (3-month TTL BR-11)', async () => {
        // Inject an expired message into fakeDb
        fakeDb.messages.push({
          id: randomUUID(),
          conversation_id: createdConvId,
          sender_id: sellerUser.id,
          type: 'TEXT',
          content: 'Nội dung tin nhắn cực kỳ mật',
          created_at: new Date('2026-01-01T00:00:00Z'),
          expires_at: new Date('2026-04-01T00:00:00Z'), // expired in past
        });

        const res = await request(app.getHttpServer())
          .get(`/api/v1/conversations/${createdConvId}/messages`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);

        const expiredMsg = res.body.data.find(
          (m: { expiresAt: string }) => new Date(m.expiresAt) < new Date(),
        );
        expect(expiredMsg).toBeDefined();
        // Content MUST be null when expired according to contract & BR-11
        expect(expiredMsg.content).toBeNull();
      });
    });

    describe('POST /api/v1/conversations/:id/attachments (Secure Attachments)', () => {
      let createdAttachmentId: string;

      it('AC11: Uploads document attachment successfully (PDF, <= 10MB)', async () => {
        const pdfBuffer = Buffer.from('%PDF-1.4 Mock PDF Content for Campus Marketplace');

        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/attachments`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .attach('file', pdfBuffer, 'de_cuong_on_tap.pdf')
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.type).toBe('ATTACHMENT');
        expect(res.body.data.content).toBeNull();
        expect(res.body.data.attachment).toBeDefined();
        expect(res.body.data.attachment.fileName).toBe('de_cuong_on_tap.pdf');
        expect(res.body.data.attachment.mimeType).toBe('application/pdf');
        expect(res.body.data.attachment.status).toBe('ACTIVE');
        expect(res.body.data.attachment.downloadUrl).toBe(
          `/api/v1/conversations/${createdConvId}/attachments/${res.body.data.attachment.id}/download`,
        );

        createdAttachmentId = res.body.data.attachment.id;
      });

      it('AC12: Uploads image attachment successfully (JPEG/PNG)', async () => {
        const imgBuffer = Buffer.from('FAKE_PNG_BINARY_BYTES');

        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/attachments`)
          .set('Authorization', `Bearer ${sellerToken}`)
          .attach('file', imgBuffer, 'anh_sach_that.png')
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.attachment.fileName).toBe('anh_sach_that.png');
        expect(res.body.data.attachment.status).toBe('ACTIVE');
      });

      it('AC13: Blocks unsupported file types (415 Unsupported Media Type)', async () => {
        const exeBuffer = Buffer.from('MZ_WINDOWS_EXECUTABLE');

        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/attachments`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .attach('file', exeBuffer, 'trojan.exe')
          .expect(415);

        expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      });

      it('AC14: Blocks files larger than 10 MB (413 Payload Too Large)', async () => {
        const bigBuffer = Buffer.alloc(11 * 1024 * 1024);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/attachments`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .attach('file', bigBuffer, 'video_huong_dan.mp4')
          .expect(413);

        expect(['FILE_TOO_LARGE', 'PAYLOAD_TOO_LARGE']).toContain(res.body.error.code);
      });

      it('AC15: Blocks outsider from sending attachment to another conversation (403)', async () => {
        const pdfBuffer = Buffer.from('PDF_CONTENT');

        const res = await request(app.getHttpServer())
          .post(`/api/v1/conversations/${createdConvId}/attachments`)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .attach('file', pdfBuffer, 'document.pdf')
          .expect(403);

        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      describe('GET /api/v1/conversations/:id/attachments/:attId/download', () => {
        it('AC16: Member can access valid attachment download info', async () => {
          const res = await request(app.getHttpServer())
            .get(`/api/v1/conversations/${createdConvId}/attachments/${createdAttachmentId}/download`)
            .set('Authorization', `Bearer ${sellerToken}`)
            .expect(200);

          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(createdAttachmentId);
          expect(res.body.data.status).toBe('ACTIVE');
          expect(res.body.data.downloadUrl).toBeDefined();
        });

        it('AC17: Blocks outsider from downloading attachment (403)', async () => {
          const res = await request(app.getHttpServer())
            .get(`/api/v1/conversations/${createdConvId}/attachments/${createdAttachmentId}/download`)
            .set('Authorization', `Bearer ${outsiderToken}`)
            .expect(403);

          expect(res.body.error.code).toBe('FORBIDDEN');
        });

        it('AC18: Denies download for expired attachment (409 ATTACHMENT_EXPIRED BR-11)', async () => {
          // Inject an expired attachment into fakeDb
          const expiredAttId = randomUUID();
          const expiredMsgId = randomUUID();

          fakeDb.messages.push({
            id: expiredMsgId,
            conversation_id: createdConvId,
            sender_id: sellerUser.id,
            type: 'ATTACHMENT',
            content: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
            expires_at: new Date('2026-02-01T00:00:00Z'),
          });

          fakeDb.attachments.push({
            id: expiredAttId,
            message_id: expiredMsgId,
            storage_key: 'attachments/conv/expired.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1024,
            expires_at: new Date('2026-02-01T00:00:00Z'), // expired 1 month in past
            status: 'ACTIVE',
          });

          const res = await request(app.getHttpServer())
            .get(`/api/v1/conversations/${createdConvId}/attachments/${expiredAttId}/download`)
            .set('Authorization', `Bearer ${buyerToken}`)
            .expect(409);

          expect(res.body.error.code).toBe('ATTACHMENT_EXPIRED');
        });
      });
    });
  });
});
