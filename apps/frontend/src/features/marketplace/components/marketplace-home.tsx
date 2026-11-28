'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts, canReadMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { canViewFeed, marketplaceError } from '../api';
import type { FeedItem, SearchPost } from '../types';
import { MarketplaceShell } from './marketplace-shell';
import styles from '../marketplace.module.css';

const feedDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
});
const cardCurrency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 2,
});

function MarketplaceHero({
  canPublish,
  verificationStatus,
}: {
  canPublish: boolean;
  verificationStatus: 'PENDING' | 'REJECTED' | undefined;
}) {
  const rejected = verificationStatus === 'REJECTED';
  return (
    <section className={styles.hero} aria-labelledby="marketplace-hero-title">
      <div className={styles.heroBand}>
        <div className={styles.heroInner}>
          <h1 id="marketplace-hero-title" className={styles.feedTitle}>
            Đồ cũ, giá trị mới. <span>Ngay trong campus.</span>
          </h1>
          <p>
            {verificationStatus
              ? 'Hoàn thiện hồ sơ sinh viên để sử dụng đầy đủ các tính năng của Campus Marketplace.'
              : 'Đăng bán đồ còn tốt hoặc tìm món bạn cần trong cộng đồng sinh viên.'}
          </p>
        </div>
      </div>
      <nav className={styles.heroActions} aria-label="Thao tác bảng tin">
        {verificationStatus ? (
          <Link href="/verification" className={styles.primaryLink}>
            {rejected ? 'Nộp lại minh chứng' : 'Hồ sơ xác thực'} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          canPublish && (
            <Link href="/posts/new" className={styles.primaryLink}>
              <span aria-hidden="true">+</span> Đăng tin
            </Link>
          )
        )}
        {!rejected && (
          <a
            href="#feed-title"
            className={canPublish || verificationStatus ? styles.heroBrowse : styles.primaryLink}
          >
            Xem tin mới <span aria-hidden="true">↓</span>
          </a>
        )}
      </nav>
    </section>
  );
}

export function FeedCard({
  item,
  canOpen,
  showMatchReasons = false,
}: {
  item: FeedItem | SearchPost;
  canOpen: boolean;
  showMatchReasons?: boolean;
}) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const thumbnail = item.thumbnailUrl;
  const showThumbnail =
    thumbnail && /^https?:\/\//i.test(thumbnail) && thumbnail !== failedThumbnail;
  const date = Date.parse(item.createdAt);
  const hasDate = Number.isFinite(date);
  const fullPost = 'province' in item ? item : undefined;
  const matchReasons = showMatchReasons
    ? [...new Set(fullPost?.matchedReasons?.map((reason) => reason.trim()).filter(Boolean))]
    : [];
  let amount: string | undefined;
  if (fullPost?.postType === 'SELL' && fullPost.price != null)
    amount = cardCurrency.format(fullPost.price);
  if (
    fullPost?.postType === 'BUY_REQUEST' &&
    fullPost.budgetMin != null &&
    fullPost.budgetMax != null
  ) {
    amount = `${cardCurrency.format(fullPost.budgetMin)} – ${cardCurrency.format(fullPost.budgetMax)}`;
  }

  return (
    <article className={styles.card} data-openable={canOpen}>
      <div className={styles.productImage}>
        {showThumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedThumbnail(thumbnail)}
          />
        ) : (
          <span className={styles.imagePlaceholder}>Chưa có ảnh</span>
        )}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.postType} data-type={item.postType}>
          {item.postType === 'SELL' ? 'Đăng bán' : 'Tìm mua'}
        </span>
        <h3>
          {canOpen ? (
            <Link
              className={styles.feedCardLink}
              href={`/posts/${encodeURIComponent(item.id)}`}
              prefetch={false}
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </h3>
        {amount && <p className={styles.cardAmount}>{amount}</p>}
        {fullPost?.province && <p className={styles.cardProvince}>{fullPost.province}</p>}
        {matchReasons.length > 0 && (
          <ul className={styles.matchReasons} aria-label="Lý do phù hợp">
            {matchReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {(hasDate || canOpen) && (
          <div className={styles.cardMeta}>
            {hasDate && <time dateTime={item.createdAt}>Đăng {feedDate.format(date)}</time>}
            {canOpen && (
              <span className={styles.cardArrow} aria-hidden="true">
                →
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function MarketplaceHome({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const status = session?.user.verificationStatus;
  const role = session?.user.role;
  const userId = session?.user.id;
  const canOpenFeedItem = canReadMarketplacePosts(session?.user);
  const studentVerification =
    role === 'USER' && (status === 'PENDING' || status === 'REJECTED') ? status : undefined;
  const rejected = studentVerification === 'REJECTED';
  useEffect(() => {
    if (!userId || !status || !role || rejected) return;
    if (!canViewFeed(status, role)) {
      router.replace('/verification');
      return;
    }
    const request = new AbortController();
    setLoading(true);
    setError('');
    setItems([]);
    void (async () => {
      try {
        const verification = await client.getVerification(request.signal);
        if (request.signal.aborted || !canViewFeed(verification.status, role)) return;
        const page = await client.getFeed(request.signal);
        if (!request.signal.aborted) setItems(page.data);
      } catch (failure) {
        if (request.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) client.clearSession();
        setError(marketplaceError(failure));
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    })();
    return () => request.abort();
  }, [client, userId, status, role, rejected, attempt, router]);

  if (!rejected && status && role && !canViewFeed(status, role))
    return (
      <MarketplaceShell client={client}>
        <p role="status">Đang chuyển đến hồ sơ xác thực…</p>
      </MarketplaceShell>
    );
  const banner = (
    <MarketplaceHero
      canPublish={canPublishMarketplacePosts(session?.user)}
      verificationStatus={studentVerification}
    />
  );

  if (rejected) {
    return (
      <MarketplaceShell client={client} isHome banner={banner}>
        <section className={styles.verificationBanner} aria-labelledby="rejected-title">
          <h2 id="rejected-title">Hồ sơ xác thực cần nộp lại</h2>
          <p>Mở hồ sơ để xem lý do từ chối và gửi lại minh chứng trước khi truy cập bảng tin.</p>
        </section>
      </MarketplaceShell>
    );
  }

  return (
    <MarketplaceShell client={client} isHome banner={banner}>
      {studentVerification === 'PENDING' && (
        <section className={styles.verificationBanner} aria-labelledby="pending-title">
          <div className={styles.verificationBannerBody}>
            <div>
              <h2 id="pending-title">Tài khoản đang chờ xác thực sinh viên</h2>
              <p id="pending-permissions">
                Bạn có thể xem tóm tắt tin đăng. Hoàn tất xác thực để xem chi tiết và mở các thao
                tác bên dưới.
              </p>
            </div>
            <Link href="/verification" className={styles.primaryLink}>
              Hoàn thiện hồ sơ <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className={styles.lockedActions} aria-describedby="pending-permissions">
            {['Tìm kiếm', 'Lọc sản phẩm', 'Đăng tin', 'Nhắn tin'].map((action) => (
              <button type="button" disabled key={action}>
                {action} · Chưa mở khóa
              </button>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="feed-title" className={styles.feedSection}>
        <div className={styles.sectionHeading}>
          <h2 id="feed-title" tabIndex={-1}>
            Tin đăng mới
          </h2>
          {items.length > 0 && <span>{items.length} tin đang hiển thị</span>}
        </div>
        {loading ? (
          <div role="status">
            <p className={styles.loadingLabel}>Đang tải bảng tin…</p>
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className={styles.skeleton} key={index}>
                  <div />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className={styles.feedState} data-kind="error">
            <h3>Chưa tải được bảng tin</h3>
            <p role="alert">{error}</p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.feedState}>
            <h3>Chưa có tin đăng nào</h3>
            <p>Hãy quay lại sau để xem các tin mới trong cộng đồng.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <FeedCard item={item} canOpen={canOpenFeedItem} key={item.id} />
            ))}
          </div>
        )}
      </section>
    </MarketplaceShell>
  );
}
