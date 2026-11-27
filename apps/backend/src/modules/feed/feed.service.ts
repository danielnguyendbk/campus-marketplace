import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { StorageService } from '../../common/storage/storage.service';
import { GetFeedQueryDto } from './dto/get-feed-query.dto';
import {
  FEED_MATCH_REASONS,
  FeedItemDto,
  FeedPostSummaryDto,
  PendingFeedItemDto,
} from './feed.types';
import {
  ApprovedFeedRow,
  FeedRepository,
  PendingFeedRow,
} from './repositories/feed.repository';

@Injectable()
export class FeedService {
  constructor(
    private readonly feedRepository: FeedRepository,
    private readonly storageService: StorageService,
  ) {}

  async getFeed(
    user: AuthenticatedUser,
    query: GetFeedQueryDto,
  ): Promise<PaginatedResult<FeedItemDto>> {
    const page =
      Number.isInteger(query.page) && (query.page as number) >= 1
        ? (query.page as number)
        : 1;
    const limit =
      Number.isInteger(query.limit) && (query.limit as number) >= 1
        ? Math.min(query.limit as number, 100)
        : 20;

    if (user.verificationStatus === 'PENDING' && user.role !== 'ADMIN') {
      const { rows, total } = await this.feedRepository.findPendingFeedPaginated(
        page,
        limit,
      );
      return {
        data: rows.map((row) => this.mapPendingFeedRow(row)),
        meta: this.buildMeta(page, limit, total),
      };
    }

    const signals = await this.feedRepository.getPersonalizationSignals(user.id);
    const favoriteCategoryIds = this.normalizeUniqueValues(
      signals.favoriteCategoryIds,
    );
    const favoriteCategorySet = new Set(favoriteCategoryIds);

    const keywordPatterns = this.normalizeUniqueValues(
      signals.interestKeywords,
      true,
    ).map((keyword) => this.escapeIlikePattern(keyword));

    const distinctActivityCategoryIds = this.normalizeUniqueValues(
      signals.activityCategoryIds,
    ).filter((categoryId) => !favoriteCategorySet.has(categoryId));

    const hasPersonalizationSignals =
      favoriteCategoryIds.length > 0 ||
      keywordPatterns.length > 0 ||
      distinctActivityCategoryIds.length > 0;

    if (!hasPersonalizationSignals) {
      const { rows, total } =
        await this.feedRepository.findApprovedColdStartFeedPaginated(page, limit);
      return {
        data: rows.map((row) => this.mapApprovedFeedRow(row, false)),
        meta: this.buildMeta(page, limit, total),
      };
    }

    const viewerProvince =
      typeof user.province === 'string' && user.province.trim().length > 0
        ? user.province.trim()
        : null;

    const { rows, total } =
      await this.feedRepository.findApprovedPersonalizedFeedPaginated({
        favoriteCategoryIds,
        keywordPatterns,
        activityCategoryIds: distinctActivityCategoryIds,
        viewerProvince,
        page,
        limit,
      });

    return {
      data: rows.map((row) => this.mapApprovedFeedRow(row, true)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  private mapPendingFeedRow(row: PendingFeedRow): PendingFeedItemDto {
    return {
      id: row.id,
      title: row.title,
      postType: row.post_type,
      thumbnailUrl: row.thumbnail_storage_key
        ? this.storageService.getPublicUrl(row.thumbnail_storage_key)
        : null,
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private mapApprovedFeedRow(
    row: ApprovedFeedRow,
    includeMatchedReasons: boolean,
  ): FeedPostSummaryDto {
    const matchedReasons = includeMatchedReasons
      ? this.extractMatchedReasons(row)
      : [];

    return {
      id: row.id,
      postType: row.post_type,
      title: row.title,
      categoryId: row.category_id,
      province: row.province,
      status: row.status,
      price: row.price !== null ? Number(row.price) : null,
      budgetMin: row.budget_min !== null ? Number(row.budget_min) : null,
      budgetMax: row.budget_max !== null ? Number(row.budget_max) : null,
      thumbnailUrl: row.thumbnail_storage_key
        ? this.storageService.getPublicUrl(row.thumbnail_storage_key)
        : null,
      createdAt: this.toIsoString(row.created_at),
      ...(matchedReasons.length > 0 ? { matchedReasons } : {}),
    };
  }

  private extractMatchedReasons(row: ApprovedFeedRow): string[] {
    const reasons: string[] = [];
    if (row.matched_fav_category) {
      reasons.push(FEED_MATCH_REASONS.FAVORITE_CATEGORY);
    }
    if (row.matched_keyword) {
      reasons.push(FEED_MATCH_REASONS.INTEREST_KEYWORD);
    }
    if (row.matched_activity_category) {
      reasons.push(FEED_MATCH_REASONS.ACTIVITY_HISTORY);
    }
    if (row.matched_province) {
      reasons.push(FEED_MATCH_REASONS.SAME_PROVINCE);
    }
    return reasons;
  }

  private normalizeUniqueValues(
    values: string[],
    caseInsensitive = false,
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of values) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const dedupeKey = caseInsensitive ? trimmed.toLowerCase() : trimmed;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      result.push(trimmed);
    }
    return result;
  }

  private escapeIlikePattern(keyword: string): string {
    const escaped = keyword.replace(/[\\%_]/g, '\\$&');
    return `%${escaped}%`;
  }

  private buildMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
