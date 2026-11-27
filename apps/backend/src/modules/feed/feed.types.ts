import { PostSummaryDto, PostType } from '../posts/posts.types';

export const FEED_MATCH_REASONS = {
  FAVORITE_CATEGORY: 'Phù hợp danh mục yêu thích',
  INTEREST_KEYWORD: 'Khớp từ khóa quan tâm',
  ACTIVITY_HISTORY: 'Phù hợp lịch sử hoạt động',
  SAME_PROVINCE: 'Cùng khu vực',
} as const;

/**
 * OpenAPI v1.2 #/components/schemas/PendingFeedItem (additionalProperties: false).
 * Strictly 5 keys ONLY: id, title, postType, thumbnailUrl, createdAt.
 */
export interface PendingFeedItemDto {
  id: string;
  title: string;
  postType: PostType;
  thumbnailUrl: string | null;
  createdAt: string;
}

/**
 * OpenAPI v1.2 #/components/schemas/PostSummary (additionalProperties: false).
 * Extends PostSummaryDto with optional rule-based `matchedReasons`.
 */
export interface FeedPostSummaryDto extends PostSummaryDto {
  matchedReasons?: string[];
}

export type FeedItemDto = PendingFeedItemDto | FeedPostSummaryDto;

export interface PersonalizationSignals {
  favoriteCategoryIds: string[];
  interestKeywords: string[];
  activityCategoryIds: string[];
}
