export type PostStatus = 'ACTIVE' | 'HIDDEN' | 'SOLD' | 'CLOSED';

export interface PostCategory {
  id: string;
  name: string;
}

interface PostFields {
  title: string;
  description: string;
  categoryId: string;
  province: string;
}

interface SellDetail {
  price: number;
  condition: string;
  allowPhoneReveal: boolean;
}

interface BuyRequestDetail {
  budgetMin: number;
  budgetMax: number;
}

export type CreatePostInput = PostFields & {
  images: readonly File[];
} & (({ postType: 'SELL' } & SellDetail) | ({ postType: 'BUY_REQUEST' } & BuyRequestDetail));

export interface PostImage {
  id: string;
  url: string;
  sortOrder: number;
}

export type PostDetail = PostFields & {
  id: string;
  owner?: { id: string; displayName: string };
  status: PostStatus;
  createdAt: string;
  images: PostImage[];
} & (
    | { postType: 'SELL'; sellDetail: SellDetail }
    | { postType: 'BUY_REQUEST'; buyRequestDetail: BuyRequestDetail }
  );
