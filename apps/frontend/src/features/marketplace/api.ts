import { ApiClient, ApiError } from '../../services/api';
import { canReadMarketplacePosts, type AuthSession, type VerificationStatus } from '../auth/types';
import type {
  AdminVerification,
  AdminVerificationDetail,
  EvidenceFields,
  FeedItem,
  MarketplacePreferences,
  PersonalProfile,
  PostSearchQuery,
  PreferencesUpdate,
  ProfileUpdate,
  SearchPost,
  VerificationFilter,
  VerificationReview,
  VerificationState,
} from './types';

export function postSearchParams(query: PostSearchQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params;
}

function isFeedItem(item: unknown): item is FeedItem {
  if (!item || typeof item !== 'object') return false;
  const { id, title, postType, thumbnailUrl, createdAt } = item as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    Boolean(id) &&
    typeof title === 'string' &&
    (postType === 'SELL' || postType === 'BUY_REQUEST') &&
    isDate(createdAt) &&
    (thumbnailUrl == null || typeof thumbnailUrl === 'string')
  );
}

function isSearchPost(item: unknown): item is SearchPost {
  if (!isFeedItem(item)) return false;
  const { categoryId, province, status, price, budgetMin, budgetMax, matchedReasons } =
    item as unknown as Record<string, unknown>;
  return (
    typeof categoryId === 'string' &&
    typeof province === 'string' &&
    status === 'ACTIVE' &&
    [price, budgetMin, budgetMax].every(
      (amount) =>
        amount == null || (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0),
    ) &&
    (matchedReasons === undefined ||
      (Array.isArray(matchedReasons) &&
        matchedReasons.every((reason) => typeof reason === 'string')))
  );
}

function isVerificationStatus(status: unknown): status is VerificationStatus {
  return (
    status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' || status === 'SUSPENDED'
  );
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function readPersonalProfile(value: unknown): PersonalProfile {
  if (value && typeof value === 'object') {
    const { id, displayName, schoolEmail, province, verificationStatus } = value as Record<
      string,
      unknown
    >;
    if (
      typeof id === 'string' &&
      id &&
      typeof displayName === 'string' &&
      typeof schoolEmail === 'string' &&
      (province === null || typeof province === 'string') &&
      isVerificationStatus(verificationStatus)
    ) {
      return { id, displayName, schoolEmail, province, verificationStatus };
    }
  }
  throw new ApiError('Invalid profile response', 200, 'INVALID_RESPONSE_DATA');
}

function readPreferences(value: unknown): MarketplacePreferences {
  if (value && typeof value === 'object') {
    const { favoriteCategoryIds, interestKeywords, updatedAt } = value as Record<string, unknown>;
    if (
      Array.isArray(favoriteCategoryIds) &&
      favoriteCategoryIds.every((entry) => typeof entry === 'string') &&
      Array.isArray(interestKeywords) &&
      interestKeywords.every((entry) => typeof entry === 'string') &&
      isDate(updatedAt)
    ) {
      return { favoriteCategoryIds, interestKeywords, updatedAt };
    }
  }
  throw new ApiError('Invalid preferences response', 200, 'INVALID_RESPONSE_DATA');
}

function adminVerification(value: unknown, expectedId?: string): AdminVerification {
  if (!value || typeof value !== 'object') {
    throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
  }
  const {
    id,
    status,
    schoolEmail,
    displayName,
    school,
    studentCode,
    submittedAt,
    reason,
    reviewedAt,
  } = value as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    !id ||
    (expectedId !== undefined && expectedId !== id) ||
    !isVerificationStatus(status) ||
    typeof schoolEmail !== 'string' ||
    typeof displayName !== 'string' ||
    (school != null && typeof school !== 'string') ||
    (studentCode != null && typeof studentCode !== 'string') ||
    !isDate(submittedAt) ||
    (reason != null && typeof reason !== 'string') ||
    (reviewedAt != null && !isDate(reviewedAt))
  ) {
    throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
  }
  // Keep evidence URLs out of list and review responses.
  return {
    id,
    status,
    schoolEmail,
    displayName,
    school: school ?? null,
    studentCode: studentCode ?? null,
    submittedAt,
    reason: reason ?? null,
    reviewedAt: reviewedAt ?? null,
  };
}

const adminVerificationsPath = '/admin/verifications';
const evidenceImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function adminVerificationPath(id: string) {
  return `${adminVerificationsPath}/${encodeURIComponent(id)}`;
}

export function createMarketplaceApi(client: ApiClient) {
  async function activePostPage(path: string, signal?: AbortSignal) {
    const page = await client.requestPaginated<unknown>(path, { method: 'GET', signal });
    if (!page.data.every(isSearchPost)) {
      throw new ApiError('Invalid post summary response', 200, 'INVALID_RESPONSE_DATA');
    }
    return { ...page, data: page.data };
  }

  function verification(value: unknown): VerificationState {
    if (!value || typeof value !== 'object')
      throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
    const state = value as Omit<VerificationState, 'submittedAt'> & {
      submittedAt?: string | null;
    };
    if (
      !isVerificationStatus(state.status) ||
      (state.reason != null && typeof state.reason !== 'string') ||
      (state.submittedAt != null && !isDate(state.submittedAt))
    ) {
      throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
    }
    // Only retain public verification fields, never evidence URLs or uploaded images.
    return {
      status: state.status,
      reason: state.reason,
      submittedAt: state.submittedAt ?? undefined,
    };
  }
  return {
    async getPersonalProfile(signal?: AbortSignal) {
      return readPersonalProfile(
        await client.request<unknown>('/me', { method: 'GET', cache: 'no-store', signal }),
      );
    },
    async updatePersonalProfile({ displayName, province }: ProfileUpdate, signal?: AbortSignal) {
      return readPersonalProfile(
        await client.request<unknown>('/me', {
          method: 'PATCH',
          body: JSON.stringify({ displayName, province }),
          cache: 'no-store',
          signal,
        }),
      );
    },
    async getPreferences(signal?: AbortSignal) {
      return readPreferences(
        await client.request<unknown>('/me/preferences', {
          method: 'GET',
          cache: 'no-store',
          signal,
        }),
      );
    },
    async updatePreferences(
      { favoriteCategoryIds, interestKeywords }: PreferencesUpdate,
      signal?: AbortSignal,
    ) {
      return readPreferences(
        await client.request<unknown>('/me/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ favoriteCategoryIds, interestKeywords }),
          cache: 'no-store',
          signal,
        }),
      );
    },
    async searchPosts(query: PostSearchQuery, signal?: AbortSignal) {
      const params = postSearchParams(query);
      params.set('limit', '12');
      return activePostPage(`/posts?${params}`, signal);
    },
    async getPostMatches(id: string, signal?: AbortSignal) {
      const page = await activePostPage(`/posts/${encodeURIComponent(id)}/matches?limit=4`, signal);
      return page.data;
    },
    async getFeed(signal?: AbortSignal) {
      const page = await client.requestPaginated<unknown>('/feed', { method: 'GET', signal });
      if (!page.data.every(isFeedItem)) {
        throw new ApiError('Invalid feed response', 200, 'INVALID_RESPONSE_DATA');
      }
      // This landing screen deliberately uses only the summary fields shared with PendingFeedItem.
      return {
        ...page,
        data: page.data.map(({ id, title, postType, thumbnailUrl, createdAt }) => ({
          id,
          title,
          postType,
          thumbnailUrl,
          createdAt,
        })),
      };
    },
    async getVerification(signal?: AbortSignal) {
      return verification(
        await client.request<unknown>('/me/verification', { method: 'GET', signal }),
      );
    },
    async submitEvidence(fields: EvidenceFields, cardImage: File, signal?: AbortSignal) {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields))
        if (value.trim()) body.append(key, value.trim());
      body.append('cardImage', cardImage);
      return verification(
        await client.request<unknown>('/me/evidence', { method: 'POST', body, signal }),
      );
    },
    async listAdminVerifications(
      filter: VerificationFilter,
      page: number,
      signal?: AbortSignal,
      limit = 20,
    ) {
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filter !== 'ALL') query.set('status', filter);
      const result = await client.requestPaginated<unknown>(`${adminVerificationsPath}?${query}`, {
        method: 'GET',
        cache: 'no-store',
        signal,
      });
      return { data: result.data.map((record) => adminVerification(record)), meta: result.meta };
    },
    async getAdminVerification(id: string, signal?: AbortSignal): Promise<AdminVerificationDetail> {
      const response = await client.request<unknown>(adminVerificationPath(id), {
        method: 'GET',
        cache: 'no-store',
        signal,
      });
      const detail = adminVerification(response, id);
      const { cardImageUrl } = response as Record<string, unknown>;
      return {
        ...detail,
        cardImageUrl: typeof cardImageUrl === 'string' && cardImageUrl.trim() ? cardImageUrl : null,
      };
    },
    getAdminEvidenceImage(resourceUrl: string, signal?: AbortSignal) {
      return client.requestPrivateImage(
        resourceUrl,
        `${adminVerificationsPath}/download`,
        evidenceImageTypes,
        signal,
      );
    },
    async reviewAdminVerification(id: string, review: VerificationReview, signal?: AbortSignal) {
      const result = adminVerification(
        await client.request<unknown>(adminVerificationPath(id), {
          method: 'PATCH',
          body: JSON.stringify(review),
          cache: 'no-store',
          signal,
        }),
        id,
      );
      if (result.status !== review.decision) {
        throw new ApiError('Unexpected verification result', 200, 'INVALID_RESPONSE_DATA');
      }
      return result;
    },
  };
}

export function marketplaceError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Tài khoản hiện không được phép thực hiện thao tác này.';
  if (error.status === 413) return 'Ảnh vượt giới hạn 10 MB. Vui lòng chọn ảnh nhỏ hơn.';
  if (error.status === 415) return 'Định dạng ảnh chưa được hỗ trợ. Vui lòng chọn ảnh khác.';
  if (error.status === 429) return 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ rồi thử lại.';
  if (error.status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
  if (error.code.startsWith('INVALID_'))
    return 'Phản hồi hệ thống chưa hợp lệ. Vui lòng thử lại sau.';
  if ([400, 409, 422].includes(error.status)) return error.message;
  return 'Chưa thể hoàn thành yêu cầu. Vui lòng thử lại.';
}

export function canViewFeed(
  status: VerificationStatus,
  role: AuthSession['user']['role'],
): boolean {
  return status === 'PENDING' || canReadMarketplacePosts({ role, verificationStatus: status });
}
