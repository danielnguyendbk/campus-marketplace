import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { io, Socket } from 'socket.io-client';
import { DatabaseModule } from '../src/database/database.module';
import { PostgresService } from '../src/database/postgres.service';
import {
  ACCESS_TOKEN_JWT,
  UserRole,
  VerificationStatus,
} from '../src/modules/auth/auth.types';
import { SocketIoAdapter } from '../src/modules/realtime/adapters/socket-io.adapter';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { RealtimeModule } from '../src/modules/realtime/realtime.module';

interface FakeUserRecord {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
}

interface FakeConversationRecord {
  id: string;
  member_low_id: string;
  member_high_id: string;
}

class InMemoryPostgresForRealtime {
  public users = new Map<string, FakeUserRecord>();
  public conversations = new Map<string, FakeConversationRecord>();

  seedUser(user: FakeUserRecord) {
    this.users.set(user.id, user);
  }

  seedConversation(conv: FakeConversationRecord) {
    this.conversations.set(conv.id, conv);
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.includes('FROM "users"') && normalized.includes('WHERE "id" = $1')) {
      const u = this.users.get(String(params[0]));
      return { rows: u ? [u] : [] };
    }

    if (normalized.includes('FROM "conversations"') && normalized.includes('WHERE "id" = $1')) {
      const conv = this.conversations.get(String(params[0]));
      return { rows: conv ? [conv] : [] };
    }

    return { rows: [] };
  }
}

describe('Realtime Socket.IO Gateway E2E (BE-01-T08 / CMP-15)', () => {
  let app: INestApplication;
  let gateway: RealtimeGateway;
  let jwtService: JwtService;
  let serverUrl: string;
  const fakeDb = new InMemoryPostgresForRealtime();

  const approvedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.approved@ptit.edu.vn',
    display_name: 'Nguyễn Văn Duyệt',
    role: 'USER',
    verification_status: 'APPROVED',
  };

  const partnerUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.partner@ptit.edu.vn',
    display_name: 'Trần Đối Tác',
    role: 'USER',
    verification_status: 'APPROVED',
  };

  const pendingUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.pending@ptit.edu.vn',
    display_name: 'Lê Chờ Duyệt',
    role: 'USER',
    verification_status: 'PENDING',
  };

  const suspendedUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.suspended@ptit.edu.vn',
    display_name: 'Hoàng Bị Khóa',
    role: 'USER',
    verification_status: 'SUSPENDED',
  };

  const outsiderUser: FakeUserRecord = {
    id: randomUUID(),
    school_email: 'student.outsider@ptit.edu.vn',
    display_name: 'Người Ngoài Cuộc',
    role: 'USER',
    verification_status: 'APPROVED',
  };

  const conversation1: FakeConversationRecord = {
    id: randomUUID(),
    member_low_id:
      approvedUser.id < partnerUser.id ? approvedUser.id : partnerUser.id,
    member_high_id:
      approvedUser.id < partnerUser.id ? partnerUser.id : approvedUser.id,
  };

  const conversationSecret: FakeConversationRecord = {
    id: randomUUID(),
    member_low_id:
      partnerUser.id < outsiderUser.id ? partnerUser.id : outsiderUser.id,
    member_high_id:
      partnerUser.id < outsiderUser.id ? outsiderUser.id : partnerUser.id,
  };

  let approvedToken: string;
  let partnerToken: string;
  let pendingToken: string;
  let suspendedToken: string;
  const activeSockets: Socket[] = [];

  const createClientSocket = (options: {
    auth?: Record<string, unknown>;
    query?: Record<string, string>;
    extraHeaders?: Record<string, string>;
  }): Socket => {
    const socket = io(serverUrl, {
      path: '/ws',
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      auth: options.auth,
      query: options.query,
      extraHeaders: options.extraHeaders,
    });
    activeSockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    fakeDb.seedUser(approvedUser);
    fakeDb.seedUser(partnerUser);
    fakeDb.seedUser(pendingUser);
    fakeDb.seedUser(suspendedUser);
    fakeDb.seedUser(outsiderUser);
    fakeDb.seedConversation(conversation1);
    fakeDb.seedConversation(conversationSecret);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, RealtimeModule],
    })
      .overrideProvider(PostgresService)
      .useValue(fakeDb)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, '*'));

    await app.listen(0);
    const serverAddress = app.getHttpServer().address();
    const port = typeof serverAddress === 'object' ? serverAddress?.port : 3000;
    serverUrl = `http://127.0.0.1:${port}`;

    gateway = moduleFixture.get<RealtimeGateway>(RealtimeGateway);
    jwtService = moduleFixture.get<JwtService>(ACCESS_TOKEN_JWT);

    approvedToken = jwtService.sign({
      sub: approvedUser.id,
      email: approvedUser.school_email,
      role: approvedUser.role,
      verificationStatus: approvedUser.verification_status,
      typ: 'access',
    });
    partnerToken = jwtService.sign({
      sub: partnerUser.id,
      email: partnerUser.school_email,
      role: partnerUser.role,
      verificationStatus: partnerUser.verification_status,
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

  afterEach(() => {
    while (activeSockets.length > 0) {
      const s = activeSockets.pop();
      if (s?.connected) {
        s.disconnect();
      }
    }
  });

  afterAll(async () => {
    for (const s of activeSockets) {
      s.disconnect();
    }
    await app.close();
  });

  describe('Part 1: Handshake Authentication & Security Directives', () => {
    it('should reject and disconnect if token is provided via Query Parameter (DISALLOWED_QUERY_AUTH)', (done) => {
      const socket = createClientSocket({
        query: { token: approvedToken },
      });

      socket.on('error', (err: { code: string; message: string }) => {
        expect(err.code).toBe('DISALLOWED_QUERY_AUTH');
        expect(err.message).toContain('Không được phép truyền token qua query parameter');
        done();
      });

      socket.connect();
    });

    it('should reject and disconnect if no token is provided', (done) => {
      const socket = createClientSocket({});

      socket.on('error', (err: { code: string }) => {
        expect(err.code).toBe('UNAUTHORIZED');
        done();
      });

      socket.connect();
    });

    it('should reject and disconnect if token is invalid or expired', (done) => {
      const socket = createClientSocket({
        auth: { token: 'invalid.token.here' },
      });

      socket.on('error', (err: { code: string }) => {
        expect(err.code).toBe('UNAUTHORIZED');
        done();
      });

      socket.connect();
    });

    it('should reject and disconnect PENDING user (ACCOUNT_NOT_VERIFIED)', (done) => {
      const socket = createClientSocket({
        auth: { token: pendingToken },
      });

      socket.on('error', (err: { code: string }) => {
        expect(err.code).toBe('ACCOUNT_NOT_VERIFIED');
        done();
      });

      socket.connect();
    });

    it('should reject and disconnect SUSPENDED user (ACCOUNT_SUSPENDED)', (done) => {
      const socket = createClientSocket({
        auth: { token: suspendedToken },
      });

      socket.on('error', (err: { code: string }) => {
        expect(err.code).toBe('ACCOUNT_SUSPENDED');
        done();
      });

      socket.connect();
    });

    it('should authenticate APPROVED user via auth payload and join personal user room', (done) => {
      const socket = createClientSocket({
        auth: { token: approvedToken },
      });

      socket.on('connected', (data: { userId: string; room: string }) => {
        expect(data.userId).toBe(approvedUser.id);
        expect(data.room).toBe(`user_${approvedUser.id}`);
        done();
      });

      socket.connect();
    });

    it('should authenticate APPROVED user via Authorization header (Bearer ...)', (done) => {
      const socket = createClientSocket({
        extraHeaders: {
          authorization: `Bearer ${approvedToken}`,
        },
      });

      socket.on('connected', (data: { userId: string }) => {
        expect(data.userId).toBe(approvedUser.id);
        done();
      });

      socket.connect();
    });
  });

  describe('Part 2: Conversation Rooms Management (join & leave)', () => {
    it('should allow conversation participant to join room conversation_{id}', (done) => {
      const socket = createClientSocket({
        auth: { token: approvedToken },
      });

      socket.on('connected', () => {
        socket.emit('join_conversation', {
          conversationId: conversation1.id,
        });
      });

      socket.on(
        'joined_conversation',
        (data: { conversationId: string; room: string }) => {
          expect(data.conversationId).toBe(conversation1.id);
          expect(data.room).toBe(`conversation_${conversation1.id}`);
          done();
        },
      );

      socket.connect();
    });

    it('should reject non-participant from joining conversation room (FORBIDDEN)', (done) => {
      const socket = createClientSocket({
        auth: { token: approvedToken },
      });

      socket.on('connected', () => {
        // approvedUser is NOT a member of conversationSecret
        socket.emit('join_conversation', {
          conversationId: conversationSecret.id,
        });
      });

      socket.on('error', (err: { code: string; message: string }) => {
        expect(err.code).toBe('FORBIDDEN');
        expect(err.message).toContain('Bạn không phải là thành viên');
        done();
      });

      socket.connect();
    });

    it('should allow participant to leave conversation room', (done) => {
      const socket = createClientSocket({
        auth: { token: approvedToken },
      });

      socket.on('connected', () => {
        socket.emit('join_conversation', {
          conversationId: conversation1.id,
        });
      });

      socket.on('joined_conversation', () => {
        socket.emit('leave_conversation', {
          conversationId: conversation1.id,
        });
      });

      socket.on(
        'left_conversation',
        (data: { conversationId: string; room: string }) => {
          expect(data.conversationId).toBe(conversation1.id);
          expect(data.room).toBe(`conversation_${conversation1.id}`);
          done();
        },
      );

      socket.connect();
    });
  });

  describe('Part 3: Realtime Broadcasting & Targeting', () => {
    it('should broadcast message to users inside the conversation room', (done) => {
      const socketA = createClientSocket({ auth: { token: approvedToken } });
      const socketB = createClientSocket({ auth: { token: partnerToken } });

      let readyCount = 0;
      const onJoined = () => {
        readyCount++;
        if (readyCount === 2) {
          // Both connected and in room -> emit to conversation
          gateway.emitToConversation(conversation1.id, 'message.created', {
            id: 'msg-test-1',
            content: 'Chào bạn, sách còn không?',
          });
        }
      };

      socketA.on('connected', () => {
        socketA.emit('join_conversation', { conversationId: conversation1.id });
      });
      socketA.on('joined_conversation', onJoined);

      socketB.on('connected', () => {
        socketB.emit('join_conversation', { conversationId: conversation1.id });
      });
      socketB.on('joined_conversation', onJoined);

      socketB.on('message.created', (msg: { id: string; content: string }) => {
        expect(msg.id).toBe('msg-test-1');
        expect(msg.content).toBe('Chào bạn, sách còn không?');
        done();
      });

      socketA.connect();
      socketB.connect();
    });

    it('should send targeted personal event to user room user_{id}', (done) => {
      const socketA = createClientSocket({ auth: { token: approvedToken } });

      socketA.on('connected', () => {
        gateway.emitToUser(approvedUser.id, 'notification.created', {
          title: 'Thông báo xét duyệt',
          message: 'Hồ sơ của bạn đã được duyệt thành công.',
        });
      });

      socketA.on('notification.created', (notif: { title: string }) => {
        expect(notif.title).toBe('Thông báo xét duyệt');
        done();
      });

      socketA.connect();
    });
  });
});

