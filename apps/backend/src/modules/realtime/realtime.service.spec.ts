import { Server } from 'socket.io';
import { MessageDto } from '../chat/chat.types';
import {
  NotificationCreatedPayload,
  REALTIME_EVENTS,
  ReportUpdatedPayload,
} from './interfaces/realtime-events.interface';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let gateway: jest.Mocked<RealtimeGateway>;
  let mockServer: jest.Mocked<Server>;

  beforeEach(() => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    gateway = {
      emitToConversation: jest.fn(),
      emitToUser: jest.fn(),
      server: mockServer,
    } as unknown as jest.Mocked<RealtimeGateway>;

    service = new RealtimeService(gateway);
  });

  describe('emitToConversation', () => {
    it('should delegate to gateway.emitToConversation', () => {
      service.emitToConversation('conv-1', 'custom.event', { foo: 'bar' });

      expect(gateway.emitToConversation).toHaveBeenCalledWith(
        'conv-1',
        'custom.event',
        { foo: 'bar' },
      );
    });
  });

  describe('emitToUser', () => {
    it('should delegate to gateway.emitToUser', () => {
      service.emitToUser('user-1', 'custom.event', { hello: 'world' });

      expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'custom.event', {
        hello: 'world',
      });
    });
  });

  describe('emitToRoom', () => {
    it('should emit to specified room when server is defined', () => {
      service.emitToRoom('custom-room', 'room.event', { data: 123 });

      expect(mockServer.to).toHaveBeenCalledWith('custom-room');
      expect(mockServer.emit).toHaveBeenCalledWith('room.event', { data: 123 });
    });
  });

  describe('emitMessageCreated', () => {
    it('should emit message.created event to conversation room', () => {
      const mockMessage: MessageDto = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        type: 'TEXT',
        content: 'Hello Realtime',
        createdAt: '2026-11-19T10:00:00.000Z',
        expiresAt: '2027-02-17T10:00:00.000Z',
      };

      service.emitMessageCreated('conv-1', mockMessage);

      expect(gateway.emitToConversation).toHaveBeenCalledWith(
        'conv-1',
        REALTIME_EVENTS.MESSAGE_CREATED,
        {
          conversationId: 'conv-1',
          message: mockMessage,
        },
      );
    });
  });

  describe('emitNotificationCreated', () => {
    it('should emit notification.created event to user personal room', () => {
      const payload: NotificationCreatedPayload = {
        id: 'notif-1',
        userId: 'user-1',
        title: 'Duyệt thành công',
        content: 'Thẻ sinh viên của bạn đã được duyệt.',
        type: 'VERIFICATION_APPROVED',
        createdAt: '2026-11-19T10:00:00.000Z',
      };

      service.emitNotificationCreated('user-1', payload);

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        REALTIME_EVENTS.NOTIFICATION_CREATED,
        payload,
      );
    });
  });

  describe('emitReportUpdated', () => {
    it('should emit report.updated event for a single user', () => {
      const payload: ReportUpdatedPayload = {
        reportId: 'rep-1',
        status: 'UNDER_REVIEW',
        updatedAt: '2026-11-19T10:00:00.000Z',
        message: 'Người bán đã gửi phản hồi giải trình.',
      };

      service.emitReportUpdated('buyer-1', payload);

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'buyer-1',
        REALTIME_EVENTS.REPORT_UPDATED,
        payload,
      );
    });

    it('should emit report.updated event for multiple target users in an array', () => {
      const payload: ReportUpdatedPayload = {
        reportId: 'rep-1',
        status: 'RESOLVED',
        updatedAt: '2026-11-19T10:00:00.000Z',
      };

      service.emitReportUpdated(['buyer-1', 'seller-1'], payload);

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'buyer-1',
        REALTIME_EVENTS.REPORT_UPDATED,
        payload,
      );
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'seller-1',
        REALTIME_EVENTS.REPORT_UPDATED,
        payload,
      );
    });
  });
});

