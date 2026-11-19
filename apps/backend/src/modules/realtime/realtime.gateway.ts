import { Inject, Injectable, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PostgresService } from '../../database/postgres.service';
import {
  ACCESS_TOKEN_JWT,
  AccessTokenPayload,
  UserRole,
  VerificationStatus,
} from '../auth/auth.types';
import { WsAuthGuard } from './guards/ws-auth.guard';
import {
  AuthenticatedSocket,
  JoinConversationPayload,
  LeaveConversationPayload,
} from './realtime.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UserRow {
  id: string;
  school_email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
}

interface ConversationMemberRow {
  id: string;
  member_low_id: string;
  member_high_id: string;
}

@Injectable()
@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(ACCESS_TOKEN_JWT) private readonly accessTokenJwt: JwtService,
    private readonly postgresService: PostgresService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    // 1. Strictly forbid token passed in Query Parameter (Security policy: prevent leakage in server logs)
    if (client.handshake?.query?.token) {
      this.logger.warn(
        `Socket connection rejected: token provided via query parameter [socketId=${client.id}]`,
      );
      client.emit('error', {
        code: 'DISALLOWED_QUERY_AUTH',
        message:
          'Không được phép truyền token qua query parameter. Vui lòng sử dụng auth payload hoặc Authorization header.',
      });
      client.disconnect(true);
      return;
    }

    // 2. Extract Bearer token from auth payload or authorization header
    let rawToken = client.handshake?.auth?.token;
    if (!rawToken && client.handshake?.headers?.authorization) {
      rawToken = client.handshake.headers.authorization;
    }

    if (!rawToken || typeof rawToken !== 'string') {
      this.logger.warn(
        `Socket connection rejected: missing authentication token [socketId=${client.id}]`,
      );
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu token xác thực để kết nối.',
      });
      client.disconnect(true);
      return;
    }

    const token = rawToken.toLowerCase().startsWith('bearer ')
      ? rawToken.slice(7).trim()
      : rawToken.trim();

    // 3. Verify JWT token
    let payload: AccessTokenPayload;
    try {
      payload = await this.accessTokenJwt.verifyAsync<AccessTokenPayload>(
        token,
      );
    } catch {
      this.logger.warn(
        `Socket connection rejected: invalid or expired token [socketId=${client.id}]`,
      );
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
      client.disconnect(true);
      return;
    }

    if (
      !payload ||
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string'
    ) {
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
      client.disconnect(true);
      return;
    }

    // 4. Query live user from PostgreSQL (Enforce APPROVED and not SUSPENDED)
    const userRes = await this.postgresService.query<UserRow>(
      `SELECT "id", "school_email", "display_name", "role", "verification_status"
       FROM "users"
       WHERE "id" = $1 AND "deleted_at" IS NULL
       LIMIT 1;`,
      [payload.sub],
    );

    const user = userRes.rows[0];
    if (!user) {
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
      });
      client.disconnect(true);
      return;
    }

    if (user.verification_status === 'SUSPENDED') {
      this.logger.warn(
        `Socket connection rejected: account suspended [userId=${user.id}]`,
      );
      client.emit('error', {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa.',
      });
      client.disconnect(true);
      return;
    }

    if (user.verification_status !== 'APPROVED' && user.role !== 'ADMIN') {
      this.logger.warn(
        `Socket connection rejected: account not verified [userId=${user.id}, status=${user.verification_status}]`,
      );
      client.emit('error', {
        code: 'ACCOUNT_NOT_VERIFIED',
        message:
          'Chỉ tài khoản sinh viên đã xác thực (APPROVED) mới được phép kết nối WebSocket.',
      });
      client.disconnect(true);
      return;
    }

    // 5. Connection authenticated successfully: Attach user and auto-join user personal room
    const authUser: AuthenticatedUser = {
      id: user.id,
      schoolEmail: user.school_email,
      displayName: user.display_name,
      role: user.role,
      verificationStatus: user.verification_status,
    };

    client.data.user = authUser;
    const userRoom = `user_${authUser.id}`;
    await client.join(userRoom);

    this.logger.log(
      `Socket connected: ${client.id} [userId=${authUser.id}, room=${userRoom}]`,
    );

    client.emit('connected', {
      userId: authUser.id,
      room: userRoom,
    });
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data?.user?.id ?? 'anonymous';
    this.logger.log(`Socket disconnected: ${client.id} [userId=${userId}]`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationPayload,
  ): Promise<{ conversationId: string; room: string } | void> {
    const conversationId = data?.conversationId;

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      client.emit('error', {
        code: 'VALIDATION_FAILED',
        message: 'conversationId phải là UUID hợp lệ.',
      });
      return;
    }

    const authUser = client.data.user!;

    // Admins can join any conversation room; users must be participants
    if (authUser.role !== 'ADMIN') {
      const convRes = await this.postgresService.query<ConversationMemberRow>(
        `SELECT "id", "member_low_id", "member_high_id"
         FROM "conversations"
         WHERE "id" = $1
         LIMIT 1;`,
        [conversationId],
      );

      const conv = convRes.rows[0];
      if (!conv) {
        client.emit('error', {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Không tìm thấy cuộc trò chuyện.',
        });
        return;
      }

      if (
        authUser.id !== conv.member_low_id &&
        authUser.id !== conv.member_high_id
      ) {
        client.emit('error', {
          code: 'FORBIDDEN',
          message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
        });
        return;
      }
    }

    const room = `conversation_${conversationId}`;
    await client.join(room);

    this.logger.log(
      `User ${authUser.id} joined conversation room: ${room} [socketId=${client.id}]`,
    );

    const payload = {
      conversationId,
      room,
    };

    client.emit('joined_conversation', payload);
    return payload;
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LeaveConversationPayload,
  ): Promise<{ conversationId: string; room: string } | void> {
    const conversationId = data?.conversationId;

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      client.emit('error', {
        code: 'VALIDATION_FAILED',
        message: 'conversationId phải là UUID hợp lệ.',
      });
      return;
    }

    const room = `conversation_${conversationId}`;
    await client.leave(room);

    const authUser = client.data.user!;
    this.logger.log(
      `User ${authUser.id} left conversation room: ${room} [socketId=${client.id}]`,
    );

    const payload = {
      conversationId,
      room,
    };

    client.emit('left_conversation', payload);
    return payload;
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`user_${userId}`).emit(event, data);
    }
  }

  emitToConversation(conversationId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`conversation_${conversationId}`).emit(event, data);
    }
  }
}
