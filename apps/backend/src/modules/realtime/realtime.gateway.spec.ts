import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { PostgresService } from '../../database/postgres.service';
import { AccessTokenPayload } from '../auth/auth.types';
import { RealtimeGateway } from './realtime.gateway';
import { AuthenticatedSocket } from './realtime.types';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: jest.Mocked<JwtService>;
  let postgresService: jest.Mocked<PostgresService>;
  let mockServer: jest.Mocked<Server>;

  const validUserId = '11111111-1111-4111-8111-111111111111';
  const validConvId = '22222222-2222-4222-8222-222222222222';

  const createMockSocket = (options: {
    query?: Record<string, string>;
    auth?: Record<string, string>;
    headers?: Record<string, string>;
    user?: unknown;
  }): jest.Mocked<AuthenticatedSocket> => {
    return {
      id: 'mock-socket-1',
      handshake: {
        query: options.query ?? {},
        auth: options.auth ?? {},
        headers: options.headers ?? {},
      },
      data: {
        user: options.user,
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthenticatedSocket>;
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    postgresService = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresService>;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    gateway = new RealtimeGateway(jwtService, postgresService);
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('should reject and disconnect if token is passed via query parameter (DISALLOWED_QUERY_AUTH)', async () => {
      const client = createMockSocket({
        query: { token: 'some-token' },
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'DISALLOWED_QUERY_AUTH',
        message: expect.stringContaining('Không được phép truyền token qua query parameter'),
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect if no token is provided', async () => {
      const client = createMockSocket({});

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Yêu cầu token xác thực để kết nối.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect if token verification fails', async () => {
      const client = createMockSocket({
        auth: { token: 'invalid-token' },
      });
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect if user does not exist in database', async () => {
      const client = createMockSocket({
        auth: { token: 'valid-token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: validUserId,
        email: 'user@example.com',
        role: 'USER',
        verificationStatus: 'APPROVED',
        typ: 'access',
      } as AccessTokenPayload);

      postgresService.query.mockResolvedValue({ rows: [] } as never);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect if user is SUSPENDED', async () => {
      const client = createMockSocket({
        headers: { authorization: 'Bearer valid-token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: validUserId,
        email: 'user@example.com',
        role: 'USER',
        verificationStatus: 'SUSPENDED',
        typ: 'access',
      } as AccessTokenPayload);

      postgresService.query.mockResolvedValue({
        rows: [
          {
            id: validUserId,
            school_email: 'user@example.com',
            display_name: 'Suspended User',
            role: 'USER',
            verification_status: 'SUSPENDED',
          },
        ],
      } as never);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa.',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect if user is PENDING and not ADMIN', async () => {
      const client = createMockSocket({
        auth: { token: 'valid-token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: validUserId,
        email: 'user@example.com',
        role: 'USER',
        verificationStatus: 'PENDING',
        typ: 'access',
      } as AccessTokenPayload);

      postgresService.query.mockResolvedValue({
        rows: [
          {
            id: validUserId,
            school_email: 'user@example.com',
            display_name: 'Pending User',
            role: 'USER',
            verification_status: 'PENDING',
          },
        ],
      } as never);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'ACCOUNT_NOT_VERIFIED',
        message: expect.stringContaining('Chỉ tài khoản sinh viên đã xác thực'),
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should authenticate APPROVED user, join user room, and emit connected event', async () => {
      const client = createMockSocket({
        auth: { token: 'Bearer valid-token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: validUserId,
        email: 'student@example.edu.vn',
        role: 'USER',
        verificationStatus: 'APPROVED',
        typ: 'access',
      } as AccessTokenPayload);

      postgresService.query.mockResolvedValue({
        rows: [
          {
            id: validUserId,
            school_email: 'student@example.edu.vn',
            display_name: 'Sinh Viên A',
            role: 'USER',
            verification_status: 'APPROVED',
          },
        ],
      } as never);

      await gateway.handleConnection(client);

      expect(client.data.user).toEqual({
        id: validUserId,
        schoolEmail: 'student@example.edu.vn',
        displayName: 'Sinh Viên A',
        role: 'USER',
        verificationStatus: 'APPROVED',
      });
      expect(client.join).toHaveBeenCalledWith(`user_${validUserId}`);
      expect(client.emit).toHaveBeenCalledWith('connected', {
        userId: validUserId,
        room: `user_${validUserId}`,
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('should reject if conversationId is invalid UUID format', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      await gateway.handleJoinConversation(client, {
        conversationId: 'invalid-uuid',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'VALIDATION_FAILED',
        message: 'conversationId phải là UUID hợp lệ.',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should emit CONVERSATION_NOT_FOUND if conversation does not exist', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      postgresService.query.mockResolvedValue({ rows: [] } as never);

      await gateway.handleJoinConversation(client, {
        conversationId: validConvId,
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should emit FORBIDDEN if user is not a member of conversation', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      postgresService.query.mockResolvedValue({
        rows: [
          {
            id: validConvId,
            member_low_id: 'other-user-1',
            member_high_id: 'other-user-2',
          },
        ],
      } as never);

      await gateway.handleJoinConversation(client, {
        conversationId: validConvId,
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'FORBIDDEN',
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should join conversation room and emit joined_conversation for participant', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      postgresService.query.mockResolvedValue({
        rows: [
          {
            id: validConvId,
            member_low_id: validUserId,
            member_high_id: 'other-user-2',
          },
        ],
      } as never);

      const result = await gateway.handleJoinConversation(client, {
        conversationId: validConvId,
      });

      expect(client.join).toHaveBeenCalledWith(`conversation_${validConvId}`);
      expect(client.emit).toHaveBeenCalledWith('joined_conversation', {
        conversationId: validConvId,
        room: `conversation_${validConvId}`,
      });
      expect(result).toEqual({
        conversationId: validConvId,
        room: `conversation_${validConvId}`,
      });
    });

    it('should allow ADMIN to join conversation room without participant check', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'ADMIN', verificationStatus: 'APPROVED' },
      });

      const result = await gateway.handleJoinConversation(client, {
        conversationId: validConvId,
      });

      expect(postgresService.query).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith(`conversation_${validConvId}`);
      expect(result).toBeDefined();
    });
  });

  describe('handleLeaveConversation', () => {
    it('should reject if conversationId is invalid', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      await gateway.handleLeaveConversation(client, {
        conversationId: 'bad-id',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'VALIDATION_FAILED',
        message: 'conversationId phải là UUID hợp lệ.',
      });
      expect(client.leave).not.toHaveBeenCalled();
    });

    it('should leave conversation room and emit left_conversation', async () => {
      const client = createMockSocket({
        user: { id: validUserId, role: 'USER', verificationStatus: 'APPROVED' },
      });

      const result = await gateway.handleLeaveConversation(client, {
        conversationId: validConvId,
      });

      expect(client.leave).toHaveBeenCalledWith(`conversation_${validConvId}`);
      expect(client.emit).toHaveBeenCalledWith('left_conversation', {
        conversationId: validConvId,
        room: `conversation_${validConvId}`,
      });
      expect(result).toEqual({
        conversationId: validConvId,
        room: `conversation_${validConvId}`,
      });
    });
  });

  describe('Broadcasting helpers', () => {
    it('should emit to user personal room', () => {
      gateway.emitToUser('user-123', 'notification.created', { id: 'notif-1' });

      expect(mockServer.to).toHaveBeenCalledWith('user_user-123');
      expect(mockServer.emit).toHaveBeenCalledWith('notification.created', {
        id: 'notif-1',
      });
    });

    it('should emit to conversation room', () => {
      gateway.emitToConversation('conv-456', 'message.created', { id: 'msg-1' });

      expect(mockServer.to).toHaveBeenCalledWith('conversation_conv-456');
      expect(mockServer.emit).toHaveBeenCalledWith('message.created', {
        id: 'msg-1',
      });
    });
  });
});
