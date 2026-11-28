'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { canPublishMarketplacePosts, canReadMarketplacePosts } from '../../auth/types';
import { AuthModeNotice } from '../../auth/components/auth-mode-notice';
import { ConversationPicker } from '../../chat/components/conversation-picker';
import chatStyles from '../../chat/components/chat.module.css';
import styles from '../marketplace.module.css';

const iconPaths = {
  campus: 'M2 10l10-5 10 5-10 5-10-5zm4 2v5l6 3 6-3v-5m4-2v7',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zm5-2 4.5 4.5',
  message: 'M5 17l-1 3 4-1a8 8 0 1 0-3-2z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 6-2 7-2 9h16c0-2-2-3-2-9zm-8 12h4',
  home: 'm3 10 9-7 9 7v10h-6v-6H9v6H3z',
  bag: 'M4 8h16l1 13H3L4 8zm4 0V6a4 4 0 0 1 8 0v2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20v-2a8 5 0 0 1 16 0v2',
  down: 'm7 10 5 5 5-5',
};

function HeaderIcon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg
      className={styles.headerIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function MarketplaceShell({
  children,
  banner,
  client = authApi,
  isHome = false,
  adminArea = false,
  section,
  searchQuery = '',
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
  client?: AuthApi;
  isHome?: boolean;
  adminArea?: boolean;
  section?: 'search' | 'SELL' | 'BUY_REQUEST' | 'profile' | 'verification' | 'messages';
  searchQuery?: string;
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

  const isAdmin = session.user.role === 'ADMIN';
  const inAdminArea = adminArea && isAdmin;
  const canDiscover = canReadMarketplacePosts(session.user);
  const profilePath =
    session.user.verificationStatus === 'APPROVED' && !isAdmin ? '/profile' : '/verification';
  const initials = session.user.displayName
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(-2)
    .join('')
    .toLocaleUpperCase('vi');
  function signOut() {
    client.clearSession();
    router.replace('/login');
  }
  const brand = (
    <Link
      href={inAdminArea ? '/admin/verifications' : '/'}
      className={styles.brand}
      aria-label={inAdminArea ? 'Campus Marketplace — Quản trị' : 'Campus Marketplace — Trang chủ'}
    >
      <span className={styles.brandMark} aria-hidden="true">
        <HeaderIcon name="campus" />
      </span>
      <span>
        Campus<small>Marketplace</small>
      </span>
    </Link>
  );
  const account = (
    <div className={styles.account}>
      <span>{session.user.displayName}</span>
      <button type="button" onClick={signOut}>
        Đăng xuất
      </button>
    </div>
  );
  const content = (
    <>
      <AuthModeNotice mode={client.mode} />
      {children}
    </>
  );

  if (inAdminArea) {
    return (
      <div className={`${styles.shell} ${styles.adminLayout}`}>
        <aside className={styles.adminSidebar}>
          {brand}
          <nav className={styles.adminNavigation} aria-label="Điều hướng quản trị">
            <Link href="/admin/verifications" aria-current="page">
              Xét duyệt hồ sơ
            </Link>
          </nav>
          <Link className={styles.marketplaceReturn} href="/">
            Xem Marketplace
          </Link>
        </aside>
        <div className={styles.adminPage}>
          <header className={styles.adminTopbar}>
            <p className={styles.adminBreadcrumb}>
              <span>Quản trị</span>
              <span aria-hidden="true">/</span>
              <span>Xác thực sinh viên</span>
            </p>
            {account}
          </header>
          <main className={styles.adminContent}>{content}</main>
        </div>
      </div>
    );
  }

  if (section === 'messages') {
    return (
      <div className={`${styles.shell} ${chatStyles.workspace}`}>
        <header className={chatStyles.inboxTopbar}>
          {brand}
          <Link href="/" className={chatStyles.marketplaceLink}>Về Marketplace</Link>
        </header>
        <main className={chatStyles.workspaceMain}>{content}</main>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={`${styles.header} ${chatStyles.pickerHost}`}>
        <div className={styles.headerInner}>
          {brand}
          <form
            action="/search"
            method="get"
            role="search"
            className={styles.headerSearch}
            onSubmit={(event) => {
              event.preventDefault();
              if (!canDiscover) return;
              const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
              router.push(query ? `/search?${new URLSearchParams({ q: query })}` : '/search');
            }}
          >
            <HeaderIcon name="search" />
            <input
              key={searchQuery}
              name="q"
              type="search"
              aria-label="Tìm tin đăng"
              defaultValue={searchQuery}
              placeholder="Tìm laptop, giáo trình, xe đạp…"
              disabled={!canDiscover}
            />
            <button type="submit" disabled={!canDiscover}>
              Tìm kiếm
            </button>
          </form>
          <div className={styles.headerActions}>
            {canPublishMarketplacePosts(session.user) ? (
              <ConversationPicker
                key={session.user.id}
                userId={session.user.id}
                icon={<HeaderIcon name="message" />}
              />
            ) : (
              <button
                className={styles.headerUnavailable}
                type="button"
                disabled
                title="Tin nhắn dành cho sinh viên đã xác thực"
              >
                <HeaderIcon name="message" /> Tin nhắn
              </button>
            )}
            <button
              className={styles.headerUnavailable}
              type="button"
              disabled
              title="Thông báo chưa khả dụng"
            >
              <HeaderIcon name="bell" /> Thông báo
            </button>
            {canPublishMarketplacePosts(session.user) && (
              <Link href="/posts/new" className={styles.publishLink}>
                <span aria-hidden="true">+</span> Đăng tin
              </Link>
            )}
            <details
              className={styles.accountMenu}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || !event.currentTarget.open) return;
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }}
            >
              <summary aria-label={`Tài khoản ${session.user.displayName}`}>
                <span className={styles.accountAvatar} aria-hidden="true">
                  {initials || 'CM'}
                </span>
                <HeaderIcon name="down" />
              </summary>
              <div className={styles.accountPanel}>
                <strong>{session.user.displayName}</strong>
                <Link href={isAdmin ? '/admin/verifications' : profilePath}>
                  {isAdmin ? 'Khu vực quản trị' : 'Hồ sơ tài khoản'}
                </Link>
                <button type="button" onClick={signOut}>
                  Đăng xuất
                </button>
              </div>
            </details>
          </div>
          <nav className={styles.navigation} aria-label="Điều hướng chính">
            <Link
              href="/"
              aria-current={isHome ? 'page' : section === 'search' ? 'location' : undefined}
            >
              <HeaderIcon name="home" /> Khám phá
            </Link>
            {(['SELL', 'BUY_REQUEST'] as const).map((type) => {
              const icon = type === 'SELL' ? 'bag' : 'search';
              const label = type === 'SELL' ? 'Đồ đang bán' : 'Tin tìm mua';
              return canDiscover ? (
                <Link
                  key={type}
                  href={`/search?type=${type}`}
                  aria-current={section === type ? 'page' : undefined}
                >
                  <HeaderIcon name={icon} /> {label}
                </Link>
              ) : (
                <span key={type} aria-disabled="true">
                  <HeaderIcon name={icon} /> {label}
                </span>
              );
            })}
            <span aria-disabled="true" title="Tin của tôi chưa khả dụng">
              <HeaderIcon name="list" /> Tin của tôi
            </span>
            {isAdmin ? (
              <Link href="/admin/verifications">
                <HeaderIcon name="person" /> Quản trị
              </Link>
            ) : (
              <Link
                href={profilePath}
                aria-current={
                  section === 'profile' || section === 'verification' ? 'page' : undefined
                }
              >
                <HeaderIcon name="person" />{' '}
                {profilePath === '/profile' ? 'Hồ sơ' : 'Hồ sơ xác thực'}
              </Link>
            )}
          </nav>
        </div>
      </header>
      {banner ? (
        <main>
          {banner}
          <div className={styles.content}>{content}</div>
        </main>
      ) : (
        <main className={styles.content}>{content}</main>
      )}
    </div>
  );
}
