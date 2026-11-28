import React from 'react';
import type { Metadata } from 'next';
import { MarketplaceSearch } from '../../features/marketplace/components/marketplace-search';
import type { PostSearchQuery } from '../../features/marketplace/types';

export const metadata: Metadata = {
  title: 'Tìm kiếm tin đăng | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const text = (name: string) => {
    const value = searchParams[name];
    return typeof value === 'string' ? value.trim() || undefined : undefined;
  };
  const amount = (name: string) => {
    const raw = text(name);
    const value = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  const type = text('type');
  const page = Number(text('page'));
  const query: PostSearchQuery = {
    q: text('q'),
    type: type === 'SELL' || type === 'BUY_REQUEST' ? type : undefined,
    categoryId: text('categoryId'),
    province: text('province'),
    min: amount('min'),
    max: amount('max'),
    page: Number.isSafeInteger(page) && page > 0 ? page : undefined,
  };
  return <MarketplaceSearch key={JSON.stringify(query)} query={query} />;
}
