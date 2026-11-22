import React from 'react';
import type { Metadata } from 'next';
import { PostDetailPage } from '../../../features/posts/components/post-detail-page';

export const metadata: Metadata = {
  title: 'Chi tiết tin đăng | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { id: string } }) {
  return <PostDetailPage id={params.id} />;
}
