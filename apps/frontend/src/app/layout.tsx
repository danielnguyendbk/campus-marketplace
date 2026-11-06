import React from 'react';
import type { Metadata } from 'next';
import './App.css';

export const metadata: Metadata = {
  title: 'Campus Marketplace',
  description: 'Nền tảng mua bán & tìm kiếm đồ dùng sinh viên nội bộ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
