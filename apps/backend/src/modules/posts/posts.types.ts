import { VerificationStatus } from '../auth/auth.types';

export type PostType = 'SELL' | 'BUY_REQUEST';
export type PostStatus = 'ACTIVE' | 'HIDDEN' | 'SOLD' | 'CLOSED';

export const ALLOWED_POST_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_POST_IMAGES_COUNT = 5;

export interface UserSummaryDto {
  id: string;
  displayName: string;
  verificationStatus: VerificationStatus;
  reputationScore: number;
  province?: string;
}

export interface SellDetailDto {
  price: number;
  condition: string;
  allowPhoneReveal: boolean;
}

export interface BuyRequestDetailDto {
  budgetMin: number;
  budgetMax: number;
}

export interface PostImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface PostDetailDto {
  id: string;
  owner: UserSummaryDto;
  postType: PostType;
  title: string;
  description: string;
  categoryId: string;
  province: string;
  status: PostStatus;
  sellDetail?: SellDetailDto;
  buyRequestDetail?: BuyRequestDetailDto;
  images: PostImageDto[];
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  closeReason?: string | null;
}

export interface PostSummaryDto {
  id: string;
  postType: PostType;
  title: string;
  categoryId: string;
  province: string;
  status: PostStatus;
  price?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}
