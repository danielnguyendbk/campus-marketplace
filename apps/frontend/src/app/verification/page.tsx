import React from 'react';
import type { Metadata } from 'next';
import { VerificationPage } from '../../features/marketplace/components/verification-page';

export const metadata: Metadata = {
  title: 'Hồ sơ xác thực | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <VerificationPage />;
}
