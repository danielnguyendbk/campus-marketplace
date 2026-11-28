import type { VerificationStatus } from '../auth/types';

export interface FeedItem {
  id: string;
  title: string;
  postType: 'SELL' | 'BUY_REQUEST';
  thumbnailUrl?: string | null;
  createdAt: string;
}

export interface PostSearchQuery {
  q?: string;
  type?: FeedItem['postType'];
  categoryId?: string;
  province?: string;
  min?: number;
  max?: number;
  page?: number;
}

export interface SearchPost extends FeedItem {
  categoryId: string;
  province: string;
  status: 'ACTIVE';
  price?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  matchedReasons?: string[];
}

export interface PersonalProfile {
  id: string;
  displayName: string;
  schoolEmail: string;
  province: string | null;
  verificationStatus: VerificationStatus;
}

export interface ProfileUpdate {
  displayName: string;
  province: string;
}

export interface PreferencesUpdate {
  favoriteCategoryIds: string[];
  interestKeywords: string[];
}

export interface MarketplacePreferences extends PreferencesUpdate {
  updatedAt: string;
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

export interface AdminVerification {
  id: string;
  status: VerificationStatus;
  schoolEmail: string;
  displayName: string;
  school: string | null;
  studentCode: string | null;
  submittedAt: string;
  reason: string | null;
  reviewedAt: string | null;
}

export interface AdminVerificationDetail extends AdminVerification {
  cardImageUrl: string | null;
}

export type VerificationFilter = VerificationStatus | 'ALL';

export type VerificationReview =
  { decision: 'APPROVED' } | { decision: 'REJECTED'; reason: string };

export const VERIFICATION_REASON_MAX_LENGTH = 500;

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
