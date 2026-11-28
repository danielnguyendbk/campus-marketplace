'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { canReadMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { ProvinceSelect } from '../../posts/components/province-select';
import type { PostCategory } from '../../posts/types';
import { marketplaceError, postSearchParams } from '../api';
import type { PostSearchQuery } from '../types';
import styles from '../marketplace.module.css';
import { FeedCard } from './marketplace-home';
import { MarketplaceShell } from './marketplace-shell';

type SearchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: boolean }
  | { kind: 'ready'; result: Awaited<ReturnType<AuthApi['searchPosts']>> };

function searchHref(query: PostSearchQuery) {
  const params = postSearchParams(query).toString();
  return params ? `/search?${params}` : '/search';
}

export function MarketplaceSearch({
  query,
  client = authApi,
}: {
  query: PostSearchQuery;
  client?: AuthApi;
}) {
  const session = useSession(client);
  const router = useRouter();
  const canSearch = canReadMarketplacePosts(session?.user);
  const userId = session?.user.id;
  const [state, setState] = useState<SearchState>({ kind: 'loading' });
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [province, setProvince] = useState(query.province ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const invalidRange = query.min !== undefined && query.max !== undefined && query.max < query.min;
  const resetHref = searchHref({ q: query.q });

  useEffect(() => {
    if (!userId || !canSearch || invalidRange) return;
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void client.searchPosts(query, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState({ kind: 'ready', result });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          client.clearSession();
          return;
        }
        setState({
          kind: 'error',
          retry: !(error instanceof ApiError && error.status === 403),
          message:
            error instanceof ApiError && [404, 405, 501].includes(error.status)
              ? 'API tìm kiếm chưa khả dụng trên máy chủ này.'
              : marketplaceError(error),
        });
      },
    );
    return () => controller.abort();
  }, [attempt, canSearch, client, invalidRange, query, userId]);

  useEffect(() => {
    if (!userId || !canSearch) return;
    const controller = new AbortController();
    setCategoriesError(false);
    void client.listMarketplaceCategories(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setCategories(data);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) client.clearSession();
        else setCategoriesError(true);
      },
    );
    return () => controller.abort();
  }, [attempt, canSearch, client, userId]);

  return (
    <MarketplaceShell client={client} section={query.type ?? 'search'} searchQuery={query.q}>
      <div className={styles.pageHeading}>
        <h1>
          {query.q
            ? `Kết quả cho “${query.q}”`
            : query.type === 'SELL'
              ? 'Đồ đang bán'
              : query.type === 'BUY_REQUEST'
                ? 'Tin tìm mua'
                : 'Tìm kiếm tin đăng'}
        </h1>
        {canSearch && !invalidRange && state.kind === 'ready' && (
          <p>{state.result.meta.total} tin phù hợp</p>
        )}
      </div>
      {!canSearch ? (
        <section className={styles.feedState}>
          <h2>Tìm kiếm dành cho sinh viên đã xác thực</h2>
          <Link className={styles.primaryLink} href="/verification">
            Hồ sơ xác thực
          </Link>
        </section>
      ) : (
        <div className={styles.searchLayout}>
          <aside className={styles.searchFilters}>
            <h2>Bộ lọc</h2>
            <button
              type="button"
              className={styles.searchFilterToggle}
              aria-expanded={filtersOpen}
              aria-controls="post-search-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
            </button>
            <form
              action="/search"
              method="get"
              className={styles.searchFilterForm}
              id="post-search-filters"
              data-expanded={filtersOpen}
              onSubmit={(event) => {
                event.preventDefault();
                const filters = new URLSearchParams();
                for (const [key, value] of new FormData(event.currentTarget)) {
                  if (typeof value === 'string' && value) filters.set(key, value);
                }
                router.push(filters.size ? `/search?${filters}` : '/search');
              }}
            >
              {query.q && <input type="hidden" name="q" value={query.q} />}
              <label>
                Loại tin
                <select name="type" defaultValue={query.type ?? ''}>
                  <option value="">Tất cả</option>
                  <option value="SELL">Đăng bán</option>
                  <option value="BUY_REQUEST">Tìm mua</option>
                </select>
              </label>
              <label>
                Danh mục
                <select name="categoryId" defaultValue={query.categoryId ?? ''}>
                  <option value="">Tất cả danh mục</option>
                  {query.categoryId &&
                    !categories.some((category) => category.id === query.categoryId) && (
                      <option value={query.categoryId}>Danh mục đã chọn</option>
                    )}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              {categoriesError && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Tải lại danh mục
                </button>
              )}
              <label>
                Giá / ngân sách từ (₫)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  name="min"
                  defaultValue={query.min}
                />
              </label>
              <label>
                Giá / ngân sách đến (₫)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  name="max"
                  defaultValue={query.max}
                />
              </label>
              <div className={styles.searchProvince}>
                <label id="province-label" htmlFor="province">
                  Tỉnh / Thành phố
                </label>
                <ProvinceSelect
                  id="province"
                  value={province}
                  disabled={false}
                  invalid={false}
                  required={false}
                  onChange={setProvince}
                />
                {province && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => setProvince('')}
                  >
                    Bỏ chọn địa phương
                  </button>
                )}
              </div>
              <button className={styles.primaryButton} type="submit">
                Áp dụng bộ lọc
              </button>
              <Link href={resetHref} className={styles.searchReset}>
                Xóa bộ lọc
              </Link>
            </form>
          </aside>
          <section aria-label="Danh sách kết quả" className={styles.searchResults}>
            {invalidRange ? (
              <div className={styles.feedState} data-kind="error">
                <h2>Khoảng giá chưa hợp lệ</h2>
                <p role="alert">Mức đến phải bằng hoặc cao hơn mức bắt đầu.</p>
              </div>
            ) : state.kind === 'loading' ? (
              <div role="status">
                <p className={styles.loadingLabel}>Đang tìm tin đăng…</p>
                <div className={styles.grid} aria-hidden="true">
                  {[1, 2, 3].map((number) => (
                    <div className={styles.skeleton} key={number}>
                      <div />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              </div>
            ) : state.kind === 'error' ? (
              <div className={styles.feedState} data-kind="error">
                <h2>Chưa tải được kết quả</h2>
                <p role="alert">{state.message}</p>
                {state.retry && (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Thử lại
                  </button>
                )}
              </div>
            ) : state.result.data.length === 0 ? (
              <div className={styles.feedState}>
                <h2>Chưa có kết quả phù hợp</h2>
                <p>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</p>
                <Link
                  href={resetHref === searchHref(query) ? '/search' : resetHref}
                  className={styles.primaryLink}
                >
                  {resetHref === searchHref(query) ? 'Xem tất cả tin' : 'Xóa bộ lọc'}
                </Link>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {state.result.data.map((item) => (
                    <FeedCard key={item.id} item={item} canOpen />
                  ))}
                </div>
                {state.result.meta.totalPages > 1 && (
                  <nav className={styles.searchPagination} aria-label="Phân trang kết quả">
                    {state.result.meta.page > 1 && (
                      <Link href={searchHref({ ...query, page: state.result.meta.page - 1 })}>
                        Trang trước
                      </Link>
                    )}
                    <span>
                      Trang {state.result.meta.page} / {state.result.meta.totalPages}
                    </span>
                    {state.result.meta.page < state.result.meta.totalPages && (
                      <Link href={searchHref({ ...query, page: state.result.meta.page + 1 })}>
                        Trang sau
                      </Link>
                    )}
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </MarketplaceShell>
  );
}
