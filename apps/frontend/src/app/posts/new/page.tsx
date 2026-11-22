import React from 'react';
import type { Metadata } from 'next';
import { CreatePostPage } from '../../../features/posts/components/create-post-page';

export const metadata: Metadata = {
  title: 'Đăng tin | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CreatePostPage />;
}
