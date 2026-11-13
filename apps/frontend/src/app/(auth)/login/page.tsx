import React from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '../../../features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Đăng nhập | Campus Marketplace',
  description: 'Đăng nhập Campus Marketplace bằng email trường của bạn.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
