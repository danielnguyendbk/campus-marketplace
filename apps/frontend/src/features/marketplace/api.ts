import { ApiClient, ApiError } from '../../services/api';
import type { VerificationStatus } from '../auth/types';
import { type EvidenceFields, type FeedItem, type VerificationState } from './types';

export function createMarketplaceApi(client: ApiClient) {
  function verification(value: unknown): VerificationState {
    if (!value || typeof value !== 'object')
      throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
    const state = value as VerificationState;
    if (
      !['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(state.status) ||
      (state.reason != null && typeof state.reason !== 'string') ||
      (state.submittedAt !== undefined &&
        (typeof state.submittedAt !== 'string' || !Number.isFinite(Date.parse(state.submittedAt))))
    ) {
      throw new ApiError('Invalid verification response', 200, 'INVALID_RESPONSE_DATA');
    }
    // Only retain public verification fields, never evidence URLs or uploaded images.
    return { status: state.status, reason: state.reason, submittedAt: state.submittedAt };
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
