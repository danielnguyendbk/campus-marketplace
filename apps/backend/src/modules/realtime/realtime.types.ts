import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
    [key: string]: unknown;
  };
}

export interface JoinConversationPayload {
  conversationId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

