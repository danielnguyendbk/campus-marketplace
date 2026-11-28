import React from 'react';
import type { Metadata } from 'next';
import { MarketplaceProfile } from '../../features/marketplace/components/marketplace-profile';

export const metadata: Metadata = {
  title: 'Hồ sơ cá nhân | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page({ searchParams }: { searchParams: { tab?: string | string[] } }) {
  const tab = searchParams.tab === 'preferences' ? 'preferences' : 'profile';
  return <MarketplaceProfile key={tab} tab={tab} />;
}
