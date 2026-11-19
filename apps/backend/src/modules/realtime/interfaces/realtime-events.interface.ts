import { MessageDto } from '../../chat/chat.types';

export const REALTIME_EVENTS = {
  MESSAGE_CREATED: 'message.created',
  NOTIFICATION_CREATED: 'notification.created',
  REPORT_UPDATED: 'report.updated',
} as const;

export type RealtimeEventType =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface MessageCreatedPayload {
  conversationId: string;
  message: MessageDto;
}

export interface NotificationCreatedPayload {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  isRead?: boolean;
}

export interface ReportUpdatedPayload {
  reportId: string;
  status: string;
  updatedAt: string;
  message?: string;
  targetUserId?: string;
}

