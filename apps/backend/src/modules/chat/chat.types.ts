import { VerificationStatus } from '../auth/auth.types';

export type ConversationStatus = 'OPEN' | 'ARCHIVED';

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
