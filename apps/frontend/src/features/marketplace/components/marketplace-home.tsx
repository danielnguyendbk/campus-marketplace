'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { canViewFeed, marketplaceError } from '../api';
import type { FeedItem } from '../types';
import { MarketplaceShell } from './marketplace-shell';
import styles from '../marketplace.module.css';

function ProductIllustration({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 240 160" fill="none" aria-hidden="true">
      <ellipse cx="122" cy="137" rx="70" ry="8" fill="#18213f0d" />
      {index % 3 === 0 ? (
        <g transform="rotate(-9 120 90)">
          <rect x="60" y="92" width="123" height="34" rx="5" fill="#F4B400" />
          <path d="M73 101h100v16H73z" fill="#FFF3CD" />
          <rect x="70" y="43" width="105" height="49" rx="5" fill="#7892BC" />
          <path d="M82 53h82v28H82z" fill="#F7FAFF" />
          <path d="M91 62h60M91 71h48" stroke="#B7C7E0" strokeWidth="3" />
          <path d="M142 43v25l9-6 9 6V43" fill="#F9C94E" />
        </g>
      ) : index % 3 === 1 ? (
        <g>
          <rect x="57" y="43" width="127" height="82" rx="6" fill="#526885" />
          <rect x="65" y="51" width="111" height="65" rx="2" fill="#E9F0FB" />
          <path d="m90 98 21-24 18 16 14-12 15 22H90Z" fill="#A1B7D9" />
          <circle cx="147" cy="69" r="8" fill="#F4B400" />
          <path d="M47 125h147l-9 8H56l-9-8Z" fill="#7892BC" />
        </g>
      ) : (
        <g>
          <path
            d="m120 56-19 65M119 57l42 25"
            stroke="#526885"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="m141 66 27 14-26 28-27-15 26-27Z" fill="#F4B400" />
          <path d="M85 130h37" stroke="#526885" strokeWidth="8" strokeLinecap="round" />
          <circle cx="119" cy="57" r="7" fill="#7892BC" />
          <path
            d="m146 105 13 14m-22-10 4 18"
            stroke="#F9C94E"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
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
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || !status) return;
    if (!canViewFeed(status)) {
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
        if (request.signal.aborted || !canViewFeed(verification.status)) return;
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
  }, [client, userId, status, attempt, router]);

  if (status && !canViewFeed(status))
    return (
      <MarketplaceShell client={client}>
        <p role="status">Đang chuyển đến hồ sơ xác thực…</p>
      </MarketplaceShell>
    );
  const pending = status === 'PENDING';
  return (
    <MarketplaceShell client={client}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>GÓC ĐỒ DÙNG SINH VIÊN</p>
          <h1>
            Đồ cũ. <span>Cơ hội mới.</span>
          </h1>
          <p>Những món đồ còn tốt, sẵn sàng cho một hành trình tiếp theo.</p>
        </div>
        <span className={styles.heroSeal} aria-hidden="true">
          ↻
        </span>
      </section>
      {pending && (
        <section className={styles.verificationBanner} aria-labelledby="pending-title">
          <div>
            <h2 id="pending-title">Tài khoản đang chờ xác thực sinh viên</h2>
            <p id="pending-permissions">
              Bạn có thể xem bảng tin giới hạn. Tìm kiếm, lọc, xem chi tiết, đăng tin, nhắn tin, xem
              số điện thoại và báo cáo sẽ được mở sau khi hồ sơ được duyệt.
            </p>
          </div>
          <Link href="/verification" className={styles.primaryLink}>
            Hoàn thiện hồ sơ <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
      {pending && (
        <div className={styles.lockedActions} aria-describedby="pending-permissions">
          <span aria-hidden="true">⌑</span>
          {['Tìm kiếm', 'Lọc sản phẩm', 'Đăng tin', 'Nhắn tin'].map((action) => (
            <button type="button" disabled key={action}>
              {action} · Chưa mở khóa
            </button>
          ))}
        </div>
      )}
      <section aria-labelledby="feed-title" className={styles.feedSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>TIẾP NỐI GIÁ TRỊ</p>
            <h2 id="feed-title">Bảng tin sinh viên</h2>
          </div>
          <span>{pending ? 'Chế độ xem giới hạn' : 'Tin mới trong cộng đồng'}</span>
        </div>
        {loading ? (
          <div className={styles.loading} role="status">
            Đang tải bảng tin…
          </div>
        ) : error ? (
          <div className={styles.state}>
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
          <div className={styles.state}>
            <h3>Chưa có tin đăng nào</h3>
            <p>Hãy quay lại sau để khám phá những món đồ mới trong cộng đồng.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item, index) => (
              <article className={styles.card} key={item.id}>
                <div className={`${styles.productImage} ${styles[`tone${index % 3}`]}`}>
                  {item.thumbnailUrl && /^https?:\/\//i.test(item.thumbnailUrl) ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ProductIllustration index={index} />
                  )}
                  <span className={styles.postType}>
                    {item.postType === 'SELL' ? 'Đăng bán' : 'Tìm mua'}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{item.title}</h3>
                  <time dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      timeZone: 'Asia/Ho_Chi_Minh',
                    }).format(new Date(item.createdAt))}
                  </time>
                  {pending && (
                    <p className={styles.lockedHint}>Xác thực sinh viên để xem chi tiết</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </MarketplaceShell>
  );
}
