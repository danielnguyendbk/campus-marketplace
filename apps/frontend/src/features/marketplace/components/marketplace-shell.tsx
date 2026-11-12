'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { AuthModeNotice } from '../../auth/components/auth-mode-notice';
import styles from '../marketplace.module.css';

export function MarketplaceShell({
  children,
  client = authApi,
}: {
  children: React.ReactNode;
  client?: AuthApi;
}) {
  const session = useSession(client);
  const router = useRouter();
  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session, router]);
  if (!session)
    return (
      <main className={styles.checking}>
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
        <Link href="/login">Đến trang đăng nhập</Link>
      </main>
    );
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Campus Marketplace — Trang chủ">
            <span aria-hidden="true">↻</span>
            <span>
              campus<small>marketplace</small>
            </span>
          </Link>
          <nav aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            <Link href="/verification">Hồ sơ xác thực</Link>
          </nav>
          <div className={styles.account}>
            <span>{session.user.displayName}</span>
            <button
              type="button"
              onClick={() => {
                client.clearSession();
                router.replace('/login');
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className={styles.content}>
        <AuthModeNotice mode={client.mode} />
        {children}
      </main>
      <footer className={styles.footer}>
        Campus Marketplace · Kết nối sinh viên. Tiếp nối giá trị.
      </footer>
    </div>
  );
}
