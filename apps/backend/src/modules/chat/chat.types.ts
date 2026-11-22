import { VerificationStatus } from '../auth/auth.types';

export type ConversationStatus = 'OPEN' | 'ARCHIVED';
export type MessageType = 'TEXT' | 'ATTACHMENT';
export type AttachmentStatus = 'ACTIVE' | 'EXPIRED' | 'DELETED';

export interface UserSummaryDto {
  id: string;
  displayName: string;
  verificationStatus: VerificationStatus;
  reputationScore: number;
  province?: string;
}

export interface ConversationDto {
  id: string;
  postId: string;
  status: ConversationStatus;
  members: UserSummaryDto[];
  lastMessageAt?: string;
  createdAt: string;
  canSend: boolean;
}

export interface AttachmentDto {
  id: string;
  fileName?: string | null;
  mimeType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  downloadUrl?: string | null;
  expiresAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string | null;
  attachment?: AttachmentDto;
  createdAt: string;
  expiresAt: string;
}

export interface ConversationParticipantContext {
  id: string;
  postId: string;
  memberLowId: string;
  memberHighId: string;
  status: ConversationStatus;
  postOwnerId: string;
  postStatus: string;
  postType: string;
  memberLowStatus: VerificationStatus;
  memberHighStatus: VerificationStatus;
}
