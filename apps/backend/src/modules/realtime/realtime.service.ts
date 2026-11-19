import { Injectable, Logger } from '@nestjs/common';
import { MessageDto } from '../chat/chat.types';
import {
  MessageCreatedPayload,
  NotificationCreatedPayload,
  REALTIME_EVENTS,
  ReportUpdatedPayload,
} from './interfaces/realtime-events.interface';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  emitToConversation<T>(conversationId: string, event: string, data: T): void {
    this.logger.debug(
      `Emitting event [${event}] to conversation [${conversationId}]`,
    );
    this.gateway.emitToConversation(conversationId, event, data);
  }

  emitToUser<T>(userId: string, event: string, data: T): void {
    this.logger.debug(`Emitting event [${event}] to user [${userId}]`);
    this.gateway.emitToUser(userId, event, data);
  }

  emitToRoom<T>(room: string, event: string, data: T): void {
    if (this.gateway.server) {
      this.logger.debug(`Emitting event [${event}] to room [${room}]`);
      this.gateway.server.to(room).emit(event, data);
    }
  }

  emitMessageCreated(conversationId: string, message: MessageDto): void {
    const payload: MessageCreatedPayload = {
      conversationId,
      message,
    };
    this.emitToConversation(
      conversationId,
      REALTIME_EVENTS.MESSAGE_CREATED,
      payload,
    );
  }

  emitNotificationCreated(
    userId: string,
    notification: NotificationCreatedPayload,
  ): void {
    this.emitToUser(userId, REALTIME_EVENTS.NOTIFICATION_CREATED, notification);
  }

  emitReportUpdated(
    targetUserIds: string | string[],
    report: ReportUpdatedPayload,
  ): void {
    const userIds = Array.isArray(targetUserIds)
      ? targetUserIds
      : [targetUserIds];
    for (const userId of userIds) {
      this.emitToUser(userId, REALTIME_EVENTS.REPORT_UPDATED, report);
    }
  }
}

