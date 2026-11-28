import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../../common/interfaces/api-response.interface';
import { StorageService } from '../../../common/storage/storage.service';
import { GetFeedQueryDto } from '../dto/get-feed-query.dto';
import { FeedPostSummaryDto, POST_MATCH_REASONS } from '../feed.types';
import {
  MatchedCounterpartRow,
  MatchingRepository,
} from '../repositories/matching.repository';

const VIETNAMESE_STOP_WORDS = new Set([
  'can',
  'cần',
  'mua',
  'ban',
  'bán',
  'tim',
  'tìm',
  'cu',
  'cũ',
  'moi',
  'mới',
  'do',
  'đồ',
  'tin',
  'cho',
  'cua',
  'của',
  'va',
  'và',
  'voi',
  'với',
  'con',
  'còn',
  'tot',
  'tốt',
  'dung',
  'dùng',
  'sinh',
  'vien',
  'viên',
]);

const MAX_EXTRACTED_KEYWORDS = 10;

@Injectable()
export class MatchingService {
  constructor(
    private readonly matchingRepository: MatchingRepository,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Computes rule-based bidirectional counterpart matches (`SELL` <-> `BUY_REQUEST`)
   * for an ACTIVE post owned by an APPROVED user.
   */
  async getPostMatches(
    postId: string,
    _viewer: AuthenticatedUser,
    query: GetFeedQueryDto,
  ): Promise<PaginatedResult<FeedPostSummaryDto>> {
    const page =
      Number.isInteger(query.page) && (query.page as number) >= 1
        ? (query.page as number)
        : 1;
    const limit =
      Number.isInteger(query.limit) && (query.limit as number) >= 1
        ? Math.min(query.limit as number, 100)
        : 20;

    const sourcePost =
      await this.matchingRepository.findSourcePostForMatching(postId);

    if (
      !sourcePost ||
      sourcePost.status !== 'ACTIVE' ||
      sourcePost.owner_verification_status !== 'APPROVED'
    ) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const targetPostType =
      sourcePost.post_type === 'SELL' ? 'BUY_REQUEST' : 'SELL';

    const sourcePrice =
      sourcePost.post_type === 'SELL' && sourcePost.price !== null
        ? Number(sourcePost.price)
        : null;
    const sourceBudgetMin =
      sourcePost.post_type === 'BUY_REQUEST' && sourcePost.budget_min !== null
        ? Number(sourcePost.budget_min)
        : null;
    const sourceBudgetMax =
      sourcePost.post_type === 'BUY_REQUEST' && sourcePost.budget_max !== null
        ? Number(sourcePost.budget_max)
        : null;

    const keywordPatterns = this.extractKeywordPatterns(sourcePost.title);

    const { rows, total } =
      await this.matchingRepository.findCounterpartMatchesPaginated({
        sourceOwnerId: sourcePost.owner_id,
        targetPostType,
        categoryId: sourcePost.category_id,
        sourcePrice,
        sourceBudgetMin,
        sourceBudgetMax,
        keywordPatterns,
        sourceProvince: sourcePost.province,
        page,
        limit,
      });

    return {
      data: rows.map((row) => this.mapMatchedRow(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /**
   * Extracts normalized Vietnamese/alphanumeric keywords from source title and
   * escapes LIKE wildcards (`\`, `%`, `_`) for safe ILIKE ANY matching.
   */
  public extractKeywordPatterns(title: string): string[] {
    if (typeof title !== 'string' || !title.trim()) {
      return [];
    }
    const tokens = title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !VIETNAMESE_STOP_WORDS.has(t));

    const unique = Array.from(new Set(tokens)).slice(0, MAX_EXTRACTED_KEYWORDS);
    return unique.map((token) => `%${token.replace(/[\\%_]/g, '\\$&')}%`);
  }

  private mapMatchedRow(row: MatchedCounterpartRow): FeedPostSummaryDto {
    const matchedReasons: string[] = [];
    if (row.matched_category) {
      matchedReasons.push(POST_MATCH_REASONS.CATEGORY);
    }
    if (row.matched_price_budget) {
      matchedReasons.push(POST_MATCH_REASONS.PRICE_BUDGET);
    }
    if (row.matched_keyword) {
      matchedReasons.push(POST_MATCH_REASONS.KEYWORD);
    }
    if (row.matched_province) {
      matchedReasons.push(POST_MATCH_REASONS.PROVINCE);
    }

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
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      ...(matchedReasons.length > 0 ? { matchedReasons } : {}),
    };
  }
}
