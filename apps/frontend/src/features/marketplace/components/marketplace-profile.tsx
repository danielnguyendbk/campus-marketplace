'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { ProvinceSelect } from '../../posts/components/province-select';
import type { PostCategory } from '../../posts/types';
import { marketplaceError } from '../api';
import type { PersonalProfile } from '../types';
import styles from '../marketplace.module.css';
import profileStyles from './marketplace-profile.module.css';
import { MarketplaceShell } from './marketplace-shell';

type ProfileTab = 'profile' | 'preferences';
type ProfileLoad =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: boolean }
  | { kind: 'ready'; profile: PersonalProfile };

function mergeKeywords(keywords: string[], text: string) {
  const unique = new Map(keywords.map((term) => [term.toLocaleLowerCase('vi'), term]));
  for (const term of text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const key = term.toLocaleLowerCase('vi');
    if (!unique.has(key)) unique.set(key, term);
  }
  return [...unique.values()];
}

export function MarketplaceProfile({
  tab,
  client = authApi,
}: {
  tab: ProfileTab;
  client?: AuthApi;
}) {
  const session = useSession(client);
  const canEdit = canPublishMarketplacePosts(session?.user);
  const userId = session?.user.id;
  const [load, setLoad] = useState<ProfileLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [province, setProvince] = useState('');
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const saveRequest = useRef<AbortController | null>(null);
  const preferenceTab = tab === 'preferences';

  useEffect(() => {
    if (!userId || !canEdit) return;
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
    setIsSaving(false);
    setSaved(false);
    setSaveError('');
    void (async () => {
      try {
        const profile = await client.getPersonalProfile(controller.signal);
        if (controller.signal.aborted) return;
        if (preferenceTab && profile.verificationStatus === 'APPROVED') {
          const [preference, categoryList] = await Promise.all([
            client.getPreferences(controller.signal),
            client.listMarketplaceCategories(controller.signal),
          ]);
          if (controller.signal.aborted) return;
          setSelected(preference.favoriteCategoryIds);
          setKeywords(preference.interestKeywords);
          setKeywordInput('');
          setCategories(categoryList);
        }
        setDisplayName(profile.displayName);
        setProvince(profile.province ?? '');
        setLoad({ kind: 'ready', profile });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) client.clearSession();
        else
          setLoad({
            kind: 'error',
            message: marketplaceError(error),
            retry: !(error instanceof ApiError && error.status === 403),
          });
      }
    })();
    return () => {
      controller.abort();
      saveRequest.current?.abort();
      saveRequest.current = null;
    };
  }, [attempt, canEdit, client, preferenceTab, userId]);

  function clearFeedback() {
    setSaved(false);
    setSaveError('');
  }

  function addKeywords() {
    setKeywords((current) => mergeKeywords(current, keywordInput));
    setKeywordInput('');
    clearFeedback();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canEdit ||
      load.kind !== 'ready' ||
      load.profile.verificationStatus !== 'APPROVED' ||
      saveRequest.current
    )
      return;
    clearFeedback();
    if (!preferenceTab && !displayName.trim()) {
      setSaveError('Vui lòng nhập tên hiển thị.');
      return;
    }
    const controller = new AbortController();
    saveRequest.current = controller;
    setIsSaving(true);
    try {
      if (preferenceTab) {
        const result = await client.updatePreferences(
          {
            favoriteCategoryIds: selected,
            interestKeywords: mergeKeywords(keywords, keywordInput),
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSelected(result.favoriteCategoryIds);
        setKeywords(result.interestKeywords);
        setKeywordInput('');
      } else {
        const profile = await client.updatePersonalProfile(
          { displayName: displayName.trim(), province },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setDisplayName(profile.displayName);
        setProvince(profile.province ?? '');
        setLoad({ kind: 'ready', profile });
      }
      setSaved(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) client.clearSession();
      else setSaveError(marketplaceError(error));
    } finally {
      if (saveRequest.current === controller) {
        saveRequest.current = null;
        if (!controller.signal.aborted) setIsSaving(false);
      }
    }
  }

  const profile = load.kind === 'ready' ? load.profile : undefined;
  const hiddenCategories = selected.filter(
    (id) => !categories.some((category) => category.id === id),
  );
  return (
    <MarketplaceShell client={client} section="profile">
      <div className={profileStyles.layout}>
        <aside className={profileStyles.sidebar}>
          {profile && (
            <div className={profileStyles.identity}>
              <strong>{profile.displayName}</strong>
              {profile.verificationStatus === 'APPROVED' && <span>Đã xác thực sinh viên</span>}
            </div>
          )}
          <nav aria-label="Quản lý hồ sơ">
            <Link href="/profile" aria-current={!preferenceTab ? 'page' : undefined}>
              Hồ sơ cá nhân
            </Link>
            {canEdit && (
              <Link
                href="/profile?tab=preferences"
                aria-current={preferenceTab ? 'page' : undefined}
              >
                Sở thích
              </Link>
            )}
            <Link href="/verification">Hồ sơ xác thực</Link>
          </nav>
        </aside>
        <section className={styles.pageHeading} aria-labelledby="marketplace-profile-title">
          <h1 id="marketplace-profile-title">
            {preferenceTab ? 'Sở thích của bạn' : 'Hồ sơ cá nhân'}
          </h1>
          {!canEdit || (profile && profile.verificationStatus !== 'APPROVED') ? (
            <div className={profileStyles.panel}>
              <p>Sinh viên đã xác thực có thể cập nhật hồ sơ cá nhân và sở thích.</p>
              <Link href="/verification" className={styles.primaryLink}>
                Xem hồ sơ xác thực
              </Link>
            </div>
          ) : load.kind === 'loading' ? (
            <div className={profileStyles.panel} role="status">
              Đang tải {preferenceTab ? 'sở thích' : 'hồ sơ'}…
            </div>
          ) : load.kind === 'error' ? (
            <div className={profileStyles.panel}>
              <p role="alert">{load.message}</p>
              {load.retry && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Thử lại
                </button>
              )}
            </div>
          ) : (
            <form
              className={`${profileStyles.panel} ${profileStyles.form}`}
              onSubmit={save}
              aria-busy={isSaving}
            >
              {preferenceTab ? (
                <>
                  <fieldset disabled={isSaving}>
                    <legend>Danh mục yêu thích</legend>
                    {categories.length > 0 || hiddenCategories.length > 0 ? (
                      <div className={profileStyles.categoryGrid}>
                        {[
                          ...categories,
                          ...hiddenCategories.map((id) => ({
                            id,
                            name: `Danh mục đã ngừng hoạt động (${id})`,
                          })),
                        ].map(({ id, name }) => (
                          <label key={id} className={profileStyles.categoryOption}>
                            <input
                              type="checkbox"
                              checked={selected.includes(id)}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setSelected((current) =>
                                  checked
                                    ? [...current, id]
                                    : current.filter((category) => category !== id),
                                );
                                clearFeedback();
                              }}
                            />{' '}
                            {name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p>Chưa có danh mục để chọn.</p>
                    )}
                  </fieldset>
                  <div className={profileStyles.keywordGroup}>
                    <label htmlFor="profile-keyword">Từ khóa sở thích</label>
                    <p id="profile-keyword-hint">
                      Có thể nhập nhiều từ khóa, ngăn cách bằng dấu phẩy.
                    </p>
                    {keywords.length > 0 && (
                      <ul className={profileStyles.keywordList}>
                        {keywords.map((term) => (
                          <li key={term}>
                            {term}
                            <button
                              type="button"
                              disabled={isSaving}
                              aria-label={`Xóa từ khóa ${term}`}
                              onClick={() => {
                                setKeywords((current) =>
                                  current.filter((keyword) => keyword !== term),
                                );
                                clearFeedback();
                              }}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className={profileStyles.keywordInput}>
                      <input
                        id="profile-keyword"
                        aria-describedby="profile-keyword-hint"
                        placeholder="Ví dụ: laptop, giáo trình"
                        value={keywordInput}
                        disabled={isSaving}
                        onChange={(event) => {
                          setKeywordInput(event.currentTarget.value);
                          clearFeedback();
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                          event.preventDefault();
                          if (keywordInput.trim()) addKeywords();
                        }}
                      />
                      <button
                        type="button"
                        className={profileStyles.addKeyword}
                        disabled={isSaving || !keywordInput.trim()}
                        onClick={addKeywords}
                      >
                        Thêm từ khóa
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Tên hiển thị
                    <input
                      value={displayName}
                      required
                      maxLength={255}
                      disabled={isSaving}
                      onChange={(event) => {
                        setDisplayName(event.currentTarget.value);
                        clearFeedback();
                      }}
                    />
                  </label>
                  <div className={profileStyles.provinceField}>
                    <label id="profile-province-label" htmlFor="profile-province">
                      Tỉnh / Thành phố
                    </label>
                    <ProvinceSelect
                      id="profile-province"
                      value={province}
                      disabled={isSaving}
                      invalid={false}
                      required={false}
                      onChange={(value) => {
                        setProvince(value);
                        clearFeedback();
                      }}
                    />
                    {province && (
                      <button
                        type="button"
                        className={styles.textButton}
                        disabled={isSaving}
                        onClick={() => {
                          setProvince('');
                          clearFeedback();
                        }}
                      >
                        Bỏ chọn địa phương
                      </button>
                    )}
                  </div>
                  <label>
                    Email trường
                    <input value={load.profile.schoolEmail} readOnly />
                  </label>
                </>
              )}
              {saveError && (
                <p className={profileStyles.error} role="alert">
                  {saveError}
                </p>
              )}
              {saved && (
                <p className={profileStyles.success} role="status">
                  {preferenceTab ? 'Đã lưu sở thích.' : 'Đã lưu hồ sơ.'}
                </p>
              )}
              <button className={styles.primaryButton} type="submit" disabled={isSaving}>
                {isSaving ? 'Đang lưu…' : preferenceTab ? 'Lưu sở thích' : 'Lưu thay đổi'}
              </button>
            </form>
          )}
        </section>
      </div>
    </MarketplaceShell>
  );
}
