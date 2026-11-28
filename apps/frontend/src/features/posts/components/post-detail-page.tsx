'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts, canReadMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { useOpenChat } from '../../chat/components/chat-overlay';
import { openMockConversation } from '../../chat/mock-conversations';
import { marketplaceError } from '../../marketplace/api';
import { FeedCard } from '../../marketplace/components/marketplace-home';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import marketplaceStyles from '../../marketplace/marketplace.module.css';
import type { SearchPost } from '../../marketplace/types';
import type { PostDetail, PostStatus } from '../types';
import styles from './create-post.module.css';

type PostLoad =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'ready'; post: PostDetail };

type MatchLoad =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'ready'; items: SearchPost[] };

const statusLabels: Record<PostStatus, string> = {
  ACTIVE: 'Đang hiển thị',
  HIDDEN: 'Đã ẩn',
  SOLD: 'Đã bán',
  CLOSED: 'Đã đóng',
};

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 2,
});

function postLoadError(error: unknown): PostLoad {
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return { kind: 'error', message: 'Không tìm thấy tin đăng.', canRetry: false };
  }
  return {
    kind: 'error',
    message: marketplaceError(error),
    canRetry: !(error instanceof ApiError && error.status === 403),
  };
}

function PostGallery({ post }: { post: PostDetail }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selectedIndex = Math.max(
    0,
    post.images.findIndex((image) => image.id === selectedId),
  );
  const activeImage = post.images[selectedIndex];
  if (!activeImage) return null;

  return (
    <section
      className={`${styles.card} ${styles.listingGallery}`}
      aria-labelledby="post-detail-images-title"
    >
      <h2 id="post-detail-images-title">
        {post.postType === 'SELL' ? 'Ảnh sản phẩm' : 'Ảnh tham khảo'}
      </h2>
      <div className={styles.galleryMain}>
        <Image
          src={activeImage.url}
          alt={`Ảnh ${selectedIndex + 1} của ${post.title}`}
          width={720}
          height={540}
          referrerPolicy="no-referrer"
          unoptimized
        />
      </div>
      {post.images.length > 1 && (
        <ul className={styles.galleryThumbnails}>
          {post.images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={`Xem ảnh ${index + 1}`}
                aria-pressed={index === selectedIndex}
                onClick={() => setSelectedId(image.id)}
              >
                <Image
                  src={image.url}
                  alt=""
                  width={88}
                  height={66}
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PostDetails({ post, viewerId }: { post: PostDetail; viewerId?: string }) {
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const openChat = useOpenChat();
  const isSell = post.postType === 'SELL';
  const gallery = post.images.length > 0 && <PostGallery post={post} />;
  const seller = post.owner;
  const canContactSeller =
    isSell &&
    post.status === 'ACTIVE' &&
    viewerId &&
    seller &&
    viewerId.toLowerCase() !== seller.id.toLowerCase();
  const description = (
    <section
      className={`${styles.card} ${styles.listingDescription}`}
      aria-labelledby="post-description-title"
    >
      <h2 id="post-description-title">Mô tả</h2>
      <p className={styles.postDescription}>{post.description}</p>
      {canContactSeller && (
        <>
          <div className={styles.contactActions}>
            <Link
              className={marketplaceStyles.primaryLink}
              href={`/messages?post=${encodeURIComponent(post.id)}`}
              onClick={(event) => {
                openMockConversation(viewerId, seller.displayName, {
                  id: post.id,
                  title: post.title,
                  price: post.sellDetail.price,
                  condition: post.sellDetail.condition,
                  imageUrl: post.images[0]?.url,
                });
                openChat?.(post.id, event);
              }}
            >
              Nhắn tin
            </Link>
            {post.sellDetail.allowPhoneReveal && (
              <button
                type="button"
                className={styles.secondaryAction}
                aria-expanded={phoneRevealed}
                aria-controls="post-phone-preview"
                onClick={() => setPhoneRevealed((visible) => !visible)}
              >
                {phoneRevealed ? 'Ẩn số điện thoại' : 'Xem số điện thoại'}
              </button>
            )}
          </div>
          {post.sellDetail.allowPhoneReveal ? (
            <div id="post-phone-preview" className={styles.phonePreview} role="status">
              {phoneRevealed && (
                <>
                  <strong>000 000 0123</strong>
                  <span>Số minh họa</span>
                </>
              )}
            </div>
          ) : (
            <p className={styles.contactNote}>Người bán không chia sẻ số điện thoại.</p>
          )}
        </>
      )}
    </section>
  );

  return (
    <div
      className={styles.listingLayout}
      data-type={post.postType}
      data-has-images={Boolean(gallery)}
    >
      <section
        className={`${styles.card} ${styles.listingInfo}`}
        aria-labelledby="post-detail-title"
      >
        <p className={styles.postStatus}>
          <strong className={isSell ? styles.sellLabel : styles.buyLabel}>
            {isSell ? 'Tin bán' : 'Tin tìm mua'}
          </strong>
          <span className={styles.statusLabel} data-active={post.status === 'ACTIVE'}>
            {statusLabels[post.status]}
          </span>
        </p>
        <h1 id="post-detail-title" className={styles.heading}>
          {post.title}
        </h1>
        <dl className={styles.listingPrice}>
          <dt>{isSell ? 'Giá bán' : 'Khoảng ngân sách'}</dt>
          <dd>
            {isSell
              ? currency.format(post.sellDetail.price)
              : `${currency.format(post.buyRequestDetail.budgetMin)} – ${currency.format(post.buyRequestDetail.budgetMax)}`}
          </dd>
        </dl>
        <dl className={styles.postFacts}>
          <div>
            <dt>Tỉnh / Thành phố</dt>
            <dd>{post.province}</dd>
          </div>
          {isSell && (
            <div>
              <dt>Tình trạng sản phẩm</dt>
              <dd>{post.sellDetail.condition}</dd>
            </div>
          )}
        </dl>
      </section>
      {isSell ? gallery : description}
      {isSell ? description : gallery}
    </div>
  );
}

function PostMatches({ client, post }: { client: AuthApi; post: PostDetail }) {
  const { id, postType } = post;
  const [load, setLoad] = useState<MatchLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void client.getPostMatches(id, controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return;
        setLoad({
          kind: 'ready',
          items: items.filter((item) => item.id !== id && item.postType !== postType),
        });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          client.clearSession();
          return;
        }
        setLoad({
          kind: 'error',
          message:
            error instanceof ApiError && [404, 405, 501].includes(error.status)
              ? 'Gợi ý tin đối ứng chưa khả dụng lúc này.'
              : marketplaceError(error),
          canRetry: !(error instanceof ApiError && error.status === 403),
        });
      },
    );
    return () => controller.abort();
  }, [attempt, client, id, postType]);

  return (
    <section className={marketplaceStyles.feedSection} aria-labelledby="post-matches-title">
      <div className={marketplaceStyles.sectionHeading}>
        <h2 id="post-matches-title">
          {postType === 'SELL' ? 'Tin tìm mua phù hợp' : 'Tin đang bán phù hợp'}
        </h2>
      </div>
      {load.kind === 'loading' ? (
        <div role="status">
          <p className={marketplaceStyles.loadingLabel}>Đang tải gợi ý…</p>
          <div className={marketplaceStyles.grid} aria-hidden="true">
            {[1, 2].map((number) => (
              <div key={number} className={marketplaceStyles.skeleton}>
                <div />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        </div>
      ) : load.kind === 'error' ? (
        <div className={marketplaceStyles.feedState} data-kind="error">
          <p role="alert">{load.message}</p>
          {load.canRetry && (
            <button
              type="button"
              className={marketplaceStyles.primaryButton}
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((value) => value + 1);
              }}
            >
              Tải lại gợi ý
            </button>
          )}
        </div>
      ) : load.items.length === 0 ? (
        <div className={marketplaceStyles.feedState}>
          <p role="status">Chưa có tin đối ứng phù hợp.</p>
        </div>
      ) : (
        <div className={marketplaceStyles.grid}>
          {load.items.map((item) => (
            <FeedCard item={item} canOpen showMatchReasons key={item.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function PostDetailContent({
  client,
  id,
  viewerId,
}: {
  client: AuthApi;
  id: string;
  viewerId?: string;
}) {
  const [load, setLoad] = useState<PostLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void client.getPostDetail(id, controller.signal).then(
      (post) => {
        if (!controller.signal.aborted) setLoad({ kind: 'ready', post });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) client.clearSession();
        else setLoad(postLoadError(error));
      },
    );
    return () => controller.abort();
  }, [attempt, client, id]);

  if (load.kind === 'ready') {
    return (
      <>
        <PostDetails post={load.post} viewerId={viewerId} />
        {load.post.status === 'ACTIVE' && <PostMatches client={client} post={load.post} />}
      </>
    );
  }

  return (
    <>
      <h1 className={styles.heading}>Chi tiết tin đăng</h1>
      <section className={styles.card}>
        {load.kind === 'loading' ? (
          <p role="status">Đang tải tin đăng…</p>
        ) : (
          <>
            <p role="alert">{load.message}</p>
            {load.canRetry && (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((value) => value + 1);
                }}
              >
                Tải lại tin
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function PostDetailPage({ id, client = authApi }: { id: string; client?: AuthApi }) {
  const session = useSession(client);
  const user = session?.user;
  const canReadPost = canReadMarketplacePosts(user);
  const canPublishPost = canPublishMarketplacePosts(user);
  return (
    <MarketplaceShell client={client}>
      <div className={styles.page}>
        <Link className={styles.backLink} href={canPublishPost ? '/posts/new' : '/'}>
          <span aria-hidden="true">‹</span> {canPublishPost ? 'Đăng tin' : 'Trang chủ'}
        </Link>
        {canReadPost ? (
          <PostDetailContent
            key={id}
            id={id}
            client={client}
            viewerId={canPublishPost ? user?.id : undefined}
          />
        ) : (
          <>
            <h1 className={styles.heading}>Chi tiết tin đăng</h1>
            <section className={styles.card}>
              {user?.verificationStatus === 'SUSPENDED' ? (
                <p>Tài khoản đang bị đình chỉ.</p>
              ) : (
                <>
                  <p>Chỉ sinh viên đã được xác thực mới có thể xem chi tiết tin đăng.</p>
                  <Link className={styles.backLink} href="/verification">
                    Xem hồ sơ xác thực
                  </Link>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </MarketplaceShell>
  );
}
