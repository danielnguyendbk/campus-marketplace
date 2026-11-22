'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../../marketplace/api';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import type { PostDetail, PostStatus } from '../types';
import styles from './create-post.module.css';

type PostLoad =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'ready'; post: PostDetail };

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

function PostDetails({ post }: { post: PostDetail }) {
  return (
    <>
      <p className={styles.postStatus}>
        <strong>{post.postType === 'SELL' ? 'Tin bán' : 'Tin tìm mua'}</strong>
        <span>{statusLabels[post.status]}</span>
      </p>
      <h1 className={styles.heading}>{post.title}</h1>
      <div className={post.images.length ? styles.columns : undefined}>
        <section className={styles.card} aria-labelledby="post-description-title">
          <h2 id="post-description-title">Thông tin tin đăng</h2>
          <dl className={styles.postFacts}>
            <div>
              <dt>Tỉnh / Thành phố</dt>
              <dd>{post.province}</dd>
            </div>
            {post.postType === 'SELL' ? (
              <>
                <div>
                  <dt>Giá bán</dt>
                  <dd>{currency.format(post.sellDetail.price)}</dd>
                </div>
                <div>
                  <dt>Tình trạng sản phẩm</dt>
                  <dd>{post.sellDetail.condition}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Khoảng ngân sách</dt>
                <dd>
                  {currency.format(post.buyRequestDetail.budgetMin)} –{' '}
                  {currency.format(post.buyRequestDetail.budgetMax)}
                </dd>
              </div>
            )}
          </dl>
          <h3>Mô tả</h3>
          <p className={styles.postDescription}>{post.description}</p>
        </section>
        {post.images.length > 0 && (
          <section className={styles.card} aria-labelledby="post-detail-images-title">
            <h2 id="post-detail-images-title">
              {post.postType === 'SELL' ? 'Ảnh sản phẩm' : 'Ảnh tham khảo'}
            </h2>
            <ul className={styles.postGallery}>
              {post.images.map((image, index) => (
                <li key={image.id}>
                  <Image
                    src={image.url}
                    alt={`Ảnh ${index + 1} của ${post.title}`}
                    width={480}
                    height={320}
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function PostDetailContent({ client, id }: { client: AuthApi; id: string }) {
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

  if (load.kind === 'ready') return <PostDetails post={load.post} />;

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
  const approved = session?.user.verificationStatus === 'APPROVED';
  return (
    <MarketplaceShell client={client}>
      <div className={styles.page}>
        <Link className={styles.backLink} href={approved ? '/posts/new' : '/'}>
          <span aria-hidden="true">‹</span> {approved ? 'Đăng tin' : 'Trang chủ'}
        </Link>
        {approved ? (
          <PostDetailContent key={id} id={id} client={client} />
        ) : (
          <>
            <h1 className={styles.heading}>Chi tiết tin đăng</h1>
            <section className={styles.card}>
              <p>Chỉ sinh viên đã được xác thực mới có thể xem chi tiết tin đăng.</p>
              <Link className={styles.backLink} href="/verification">
                Xem hồ sơ xác thực
              </Link>
            </section>
          </>
        )}
      </div>
    </MarketplaceShell>
  );
}
