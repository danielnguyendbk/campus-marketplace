import React from 'react';
import type { Metadata } from 'next';
import { AdminVerificationPage } from '../../../features/marketplace/components/admin-verification-page';

export const metadata: Metadata = {
  title: 'Xét duyệt hồ sơ | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminVerificationPage />;
}
