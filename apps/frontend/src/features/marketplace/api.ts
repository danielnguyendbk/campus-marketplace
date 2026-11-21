import { ApiClient, ApiError } from '../../services/api';
import type { VerificationStatus } from '../auth/types';
import type {
  AdminVerification,
  AdminVerificationDetail,
  EvidenceFields,
  FeedItem,
  VerificationFilter,
  VerificationReview,
  VerificationState,
} from './types';

function isVerificationStatus(status: unknown): status is VerificationStatus {
  return (
    status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' || status === 'SUSPENDED'
  );
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
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
    async getFeed(signal?: AbortSignal) {
      const page = await client.requestPaginated<FeedItem>('/feed', { method: 'GET', signal });
      if (
        !page.data.every(
          (item) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            ['SELL', 'BUY_REQUEST'].includes(item.postType) &&
            typeof item.createdAt === 'string' &&
            Number.isFinite(Date.parse(item.createdAt)) &&
            (item.thumbnailUrl == null || typeof item.thumbnailUrl === 'string'),
        )
      ) {
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
    async listAdminVerifications(filter: VerificationFilter, page: number, signal?: AbortSignal) {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
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

export function canViewFeed(status: VerificationStatus): boolean {
  return status === 'PENDING' || status === 'APPROVED';
}
