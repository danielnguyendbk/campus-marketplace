import type { VerificationStatus } from '../auth/types';

export interface FeedItem {
  id: string;
  title: string;
  postType: 'SELL' | 'BUY_REQUEST';
  thumbnailUrl?: string | null;
  createdAt: string;
}

export interface VerificationState {
  status: VerificationStatus;
  reason?: string | null;
  submittedAt?: string;
}

export interface EvidenceFields {
  school: string;
  major: string;
  className: string;
  studentCode: string;
  cohort: string;
  province: string;
}

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
