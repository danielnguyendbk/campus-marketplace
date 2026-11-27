import { ApiClient, ApiError } from '../../services/api';
import type { CreatePostInput, PostCategory, PostDetail, PostImage } from './types';

const postIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAmount(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum;
}

function invalidPost() {
  return new ApiError('Invalid post response', 200, 'INVALID_RESPONSE_DATA');
}

function postImage(value: unknown): PostImage {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.url !== 'string' ||
    !/^https?:\/\//i.test(value.url) ||
    typeof value.sortOrder !== 'number' ||
    !Number.isInteger(value.sortOrder)
  ) {
    throw invalidPost();
  }
  return { id: value.id, url: value.url, sortOrder: value.sortOrder };
}

function postDetail(value: unknown): PostDetail {
  if (!isRecord(value)) throw invalidPost();
  const { id, title, description, categoryId, province, status, createdAt, images, owner } = value;
  if (
    typeof id !== 'string' ||
    !postIdPattern.test(id) ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    typeof categoryId !== 'string' ||
    typeof province !== 'string' ||
    (status !== 'ACTIVE' && status !== 'HIDDEN' && status !== 'SOLD' && status !== 'CLOSED') ||
    typeof createdAt !== 'string' ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !Array.isArray(images)
  ) {
    throw invalidPost();
  }

  const common = {
    id,
    owner:
      isRecord(owner) &&
      typeof owner.id === 'string' &&
      owner.id.trim() &&
      typeof owner.displayName === 'string' &&
      owner.displayName.trim()
        ? { id: owner.id, displayName: owner.displayName }
        : undefined,
    title,
    description,
    categoryId,
    province,
    status,
    createdAt,
    images: images.map(postImage).sort((first, second) => first.sortOrder - second.sortOrder),
  } as const;
  if (value.postType === 'SELL' && isRecord(value.sellDetail)) {
    const { price, condition, allowPhoneReveal } = value.sellDetail;
    if (
      isAmount(price, 0.01) &&
      typeof condition === 'string' &&
      typeof allowPhoneReveal === 'boolean'
    ) {
      return { ...common, postType: 'SELL', sellDetail: { price, condition, allowPhoneReveal } };
    }
  }
  if (value.postType === 'BUY_REQUEST' && isRecord(value.buyRequestDetail)) {
    const { budgetMin, budgetMax } = value.buyRequestDetail;
    if (isAmount(budgetMin, 0) && isAmount(budgetMax, budgetMin)) {
      return { ...common, postType: 'BUY_REQUEST', buyRequestDetail: { budgetMin, budgetMax } };
    }
  }
  throw invalidPost();
}

export function createPostsApi(client: ApiClient) {
  return {
    async listPostCategories(signal?: AbortSignal): Promise<PostCategory[]> {
      const categories: PostCategory[] = [];
      for (let page = 1; ; page += 1) {
        const { data, meta } = await client.requestPaginated<unknown>(
          `/categories?page=${page}&limit=100`,
          { method: 'GET', signal },
        );
        if (meta.page !== page || !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0) {
          throw new ApiError('Invalid category pagination', 200, 'INVALID_RESPONSE_DATA');
        }
        for (const category of data) {
          if (
            !isRecord(category) ||
            typeof category.id !== 'string' ||
            !category.id.trim() ||
            typeof category.name !== 'string' ||
            !category.name.trim()
          ) {
            throw new ApiError('Invalid category response', 200, 'INVALID_RESPONSE_DATA');
          }
          categories.push({ id: category.id, name: category.name });
        }
        if (page >= meta.totalPages) return categories;
      }
    },
    async createPost(input: CreatePostInput, signal?: AbortSignal): Promise<PostDetail> {
      const body = new FormData();
      body.set('postType', input.postType);
      body.set('title', input.title.trim());
      body.set('description', input.description.trim());
      body.set('categoryId', input.categoryId);
      body.set('province', input.province.trim());
      if (input.postType === 'SELL') {
        body.set('price', String(input.price));
        body.set('condition', input.condition.trim());
        body.set('allowPhoneReveal', String(input.allowPhoneReveal));
      } else {
        body.set('budgetMin', String(input.budgetMin));
        body.set('budgetMax', String(input.budgetMax));
      }
      for (const image of input.images) body.append('images', image);

      const detail = postDetail(
        await client.request<unknown>('/posts', { method: 'POST', body, signal }),
      );
      if (detail.postType !== input.postType || detail.status !== 'ACTIVE') throw invalidPost();
      return detail;
    },
    async getPostDetail(id: string, signal?: AbortSignal): Promise<PostDetail> {
      if (!postIdPattern.test(id)) {
        throw new ApiError('Invalid post ID', 400, 'VALIDATION_FAILED');
      }
      const detail = postDetail(
        await client.request<unknown>(`/posts/${id}`, { method: 'GET', cache: 'no-store', signal }),
      );
      if (detail.id.toLowerCase() !== id.toLowerCase()) throw invalidPost();
      return detail;
    },
  };
}
