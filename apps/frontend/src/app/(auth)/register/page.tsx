import React from 'react';
import type { Metadata } from 'next';
import { RegisterForm } from '../../../features/auth/components/register-form';

export const metadata: Metadata = {
  title: 'Đăng ký | Campus Marketplace',
  description: 'Đăng ký Campus Marketplace bằng email trường và xác thực OTP.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
