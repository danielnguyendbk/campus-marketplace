'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type PaginatedResult } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import type { VerificationStatus } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../api';
import {
  VERIFICATION_REASON_MAX_LENGTH,
  type AdminVerification,
  type AdminVerificationDetail,
  type VerificationFilter,
  type VerificationReview,
} from '../types';
import { MarketplaceShell } from './marketplace-shell';
import styles from './admin-verification.module.css';

type Load<T> =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: T };

const statusLabels: Record<VerificationStatus, string> = {
  PENDING: 'Chờ xét duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  SUSPENDED: 'Đã đình chỉ',
};
const filters: { value: VerificationFilter; label: string }[] = [
  { value: 'PENDING', label: statusLabels.PENDING },
  { value: 'APPROVED', label: statusLabels.APPROVED },
  { value: 'REJECTED', label: statusLabels.REJECTED },
  { value: 'SUSPENDED', label: statusLabels.SUSPENDED },
  { value: 'ALL', label: 'Tất cả hồ sơ' },
];
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function Status({ status }: { status: VerificationStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      {statusLabels[status]}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 404) return 'Không tìm thấy hồ sơ này.';
  if (error instanceof ApiError && error.status === 409)
    return 'Hồ sơ đã thay đổi. Hãy tải lại trước khi xét duyệt.';
  return marketplaceError(error);
}

const missingImageMessage = 'Chưa có ảnh minh chứng cho hồ sơ này.';

function evidenceErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'LINK_EXPIRED') return 'Liên kết ảnh đã hết hạn. Hãy tải lại ảnh.';
    if (error.code === 'FILE_NOT_FOUND') return 'Không tìm thấy tệp ảnh minh chứng.';
  }
  return 'Không thể hiển thị ảnh minh chứng. Vui lòng thử lại.';
}

function EvidencePreview({
  record,
  client,
  onAccessError,
}: {
  record: AdminVerificationDetail;
  client: AuthApi;
  onAccessError: (error: unknown) => boolean;
}) {
  const { id, cardImageUrl } = record;
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<Load<string>>(
    cardImageUrl ? { kind: 'loading' } : { kind: 'error', message: missingImageMessage },
  );

  useEffect(() => {
    if (!cardImageUrl && attempt === 0) return;
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl: string | undefined;

    async function load() {
      const signedUrl =
        attempt === 0 ? cardImageUrl : (await client.getAdminVerification(id, signal)).cardImageUrl;
      if (signal.aborted) return;
      if (!signedUrl) {
        setImage({ kind: 'error', message: missingImageMessage });
        return;
      }
      const blob = await client.getAdminEvidenceImage(signedUrl, signal);
      if (signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setImage({ kind: 'ready', data: objectUrl });
    }

    void load().catch((error: unknown) => {
      if (signal.aborted) return;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === 'FORBIDDEN') &&
        onAccessError(error)
      ) {
        return;
      }
      setImage({ kind: 'error', message: evidenceErrorMessage(error) });
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, cardImageUrl, client, id, onAccessError]);

  return (
    <div className={styles.evidence}>
      <h3>Ảnh minh chứng</h3>
      {image.kind === 'loading' && <p role="status">Đang tải ảnh minh chứng…</p>}
      {image.kind === 'ready' && (
        <img
          className={styles.evidenceImage}
          src={image.data}
          alt="Ảnh minh chứng sinh viên"
          onError={() => setImage({ kind: 'error', message: evidenceErrorMessage(null) })}
        />
      )}
      {image.kind === 'error' && (
        <>
          <p role="alert">{image.message}</p>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setImage({ kind: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            Tải lại ảnh
          </button>
        </>
      )}
    </div>
  );
}

function ReviewDetail({
  id,
  client,
  onBack,
  onReviewed,
  onAccessError,
  onBusyChange,
}: {
  id: string;
  client: AuthApi;
  onBack: () => void;
  onReviewed: (message: string) => void;
  onAccessError: (error: unknown) => boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [detail, setDetail] = useState<Load<AdminVerificationDetail>>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const [decision, setDecision] = useState<VerificationReview['decision'] | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    heading.current?.focus();
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (decision === 'REJECTED') reasonInput.current?.focus();
    if (decision === 'APPROVED') confirmation.current?.focus();
  }, [decision]);
  useEffect(() => {
    const controller = new AbortController();
    void client.getAdminVerification(id, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setDetail({ kind: 'ready', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !onAccessError(error))
          setDetail({ kind: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [client, id, onAccessError, revision]);

  function reload() {
    setDecision(null);
    setReasonError('');
    setReviewError('');
    setNeedsReload(false);
    setDetail({ kind: 'loading' });
    setRevision((value) => value + 1);
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !decision ||
      needsReload ||
      request.current ||
      detail.kind !== 'ready' ||
      detail.data.status !== 'PENDING'
    )
      return;
    const text = reason.trim();
    if (decision === 'REJECTED' && (!text || text.length > VERIFICATION_REASON_MAX_LENGTH)) {
      setReasonError(
        text
          ? 'Lý do từ chối tối đa 500 ký tự.'
          : 'Nhập lý do từ chối để sinh viên biết cần sửa gì.',
      );
      reasonInput.current?.focus();
      return;
    }

    const review: VerificationReview =
      decision === 'APPROVED' ? { decision } : { decision, reason: text };
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    onBusyChange(true);
    setReviewError('');
    try {
      const data = await client.reviewAdminVerification(id, review, controller.signal);
      if (controller.signal.aborted) return;
      setDetail((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', data: { ...data, cardImageUrl: current.data.cardImageUrl } }
          : current,
      );
      setDecision(null);
      setReason('');
      setReasonError('');
      heading.current?.focus();
      onReviewed(decision === 'APPROVED' ? 'Đã duyệt hồ sơ.' : 'Đã từ chối hồ sơ.');
    } catch (error) {
      if (controller.signal.aborted || onAccessError(error)) return;
      if (error instanceof ApiError && error.status === 400 && decision === 'REJECTED') {
        const issue = error.details?.find((item) => item.field === 'reason');
        if (issue) {
          setReasonError(issue.message);
          return;
        }
      }
      if (error instanceof ApiError && [400, 422].includes(error.status)) {
        setReviewError(errorMessage(error));
        return;
      }
      setNeedsReload(true);
      setReviewError(
        'Chưa xác nhận được kết quả. Hãy tải lại hồ sơ trước khi gửi quyết định khác.',
      );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setSaving(false);
        onBusyChange(false);
      }
    }
  }

  const record = detail.kind === 'ready' ? detail.data : null;
  return (
    <section className={styles.panel} aria-labelledby="verification-detail-title">
      <div className={styles.detailHeader}>
        <h2 id="verification-detail-title" ref={heading} tabIndex={-1}>
          Chi tiết hồ sơ
        </h2>
        <button className={styles.secondaryButton} type="button" onClick={onBack} disabled={saving}>
          Về danh sách
        </button>
      </div>
      {detail.kind === 'loading' && (
        <p className={styles.loading} role="status">
          Đang tải hồ sơ…
        </p>
      )}
      {detail.kind === 'error' && (
        <div className={styles.state}>
          <p role="alert">{detail.message}</p>
          <button type="button" className={styles.secondaryButton} onClick={reload}>
            Thử lại
          </button>
        </div>
      )}
      {record && (
        <div className={styles.detailBody}>
          <div className={styles.profile}>
            <h3>{record.displayName}</h3>
            <p>{record.schoolEmail}</p>
            <Status status={record.status} />
          </div>
          <dl className={styles.fields}>
            <div>
              <dt>Trường</dt>
              <dd>{record.school || 'Chưa cung cấp'}</dd>
            </div>
            <div>
              <dt>Mã sinh viên</dt>
              <dd>{record.studentCode || 'Chưa cung cấp'}</dd>
            </div>
            <div>
              <dt>Ngày nộp</dt>
              <dd>
                <time dateTime={record.submittedAt}>
                  {dateTime.format(new Date(record.submittedAt))}
                </time>
              </dd>
            </div>
            {record.reviewedAt && (
              <div>
                <dt>Ngày xét duyệt</dt>
                <dd>
                  <time dateTime={record.reviewedAt}>
                    {dateTime.format(new Date(record.reviewedAt))}
                  </time>
                </dd>
              </div>
            )}
            {record.reason && (
              <div className={styles.wideField}>
                <dt>Lý do từ chối</dt>
                <dd>{record.reason}</dd>
              </div>
            )}
          </dl>
          <EvidencePreview record={record} client={client} onAccessError={onAccessError} />
          {record.status === 'PENDING' && (
            <section className={styles.decision} aria-label="Quyết định xét duyệt">
              {decision ? (
                <form onSubmit={submitReview} noValidate aria-busy={saving}>
                  <h3 ref={confirmation} tabIndex={-1}>
                    {decision === 'APPROVED' ? 'Xác nhận duyệt hồ sơ' : 'Từ chối hồ sơ'}
                  </h3>
                  {decision === 'APPROVED' ? (
                    <p>Sinh viên sẽ được xác minh sau khi bạn xác nhận.</p>
                  ) : (
                    <div className={styles.reasonField}>
                      <label htmlFor="verification-reason">Lý do từ chối (bắt buộc)</label>
                      <textarea
                        ref={reasonInput}
                        id="verification-reason"
                        value={reason}
                        required
                        maxLength={VERIFICATION_REASON_MAX_LENGTH}
                        rows={3}
                        disabled={saving || needsReload}
                        aria-invalid={Boolean(reasonError)}
                        aria-describedby={
                          reasonError
                            ? 'verification-reason-error verification-reason-hint'
                            : 'verification-reason-hint'
                        }
                        onChange={(event) => {
                          setReason(event.target.value);
                          setReasonError('');
                        }}
                      />
                      {reasonError && (
                        <p id="verification-reason-error" className={styles.error} role="alert">
                          {reasonError}
                        </p>
                      )}
                      <p id="verification-reason-hint">
                        Lý do sẽ hiển thị cho sinh viên. {reason.length}/500 ký tự.
                      </p>
                    </div>
                  )}
                  {reviewError && (
                    <p className={styles.error} role="alert">
                      {reviewError}
                    </p>
                  )}
                  <div className={styles.actions}>
                    {needsReload ? (
                      <button type="button" className={styles.secondaryButton} onClick={reload}>
                        Tải lại hồ sơ
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className={
                          decision === 'APPROVED' ? styles.primaryButton : styles.dangerButton
                        }
                        disabled={saving}
                      >
                        {saving
                          ? 'Đang gửi…'
                          : decision === 'APPROVED'
                            ? 'Xác nhận duyệt'
                            : 'Xác nhận từ chối'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setDecision(null);
                        setReasonError('');
                        setReviewError('');
                        heading.current?.focus();
                      }}
                      disabled={saving || needsReload}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => setDecision('APPROVED')}
                  >
                    Duyệt hồ sơ
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setDecision('REJECTED')}
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewQueue({ client }: { client: AuthApi }) {
  const [filter, setFilter] = useState<VerificationFilter>('PENDING');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queue, setQueue] = useState<Load<PaginatedResult<AdminVerification>>>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const focusQueue = useRef(false);

  const onAccessError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      if (error.status === 401) {
        client.clearSession();
        return true;
      }
      if (error.status !== 403) return false;
      setForbidden(true);
      setQueue({ kind: 'loading' });
      setSelectedId(null);
      setNotice('');
      return true;
    },
    [client],
  );

  useEffect(() => {
    if (forbidden) return;
    const controller = new AbortController();
    void client.listAdminVerifications(filter, page, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, data.meta.totalPages);
        if (page > lastPage) {
          setQueue({ kind: 'loading' });
          setPage(lastPage);
          return;
        }
        setQueue({ kind: 'ready', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !onAccessError(error))
          setQueue({ kind: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [client, filter, page, revision, forbidden, onAccessError]);

  useEffect(() => {
    if (selectedId === null && focusQueue.current) {
      focusQueue.current = false;
      queueHeading.current?.focus();
    }
  }, [selectedId]);

  function reloadQueue() {
    setQueue({ kind: 'loading' });
    setRevision((value) => value + 1);
  }

  function goBack() {
    focusQueue.current = true;
    setSelectedId(null);
  }

  if (forbidden)
    return (
      <p className={styles.state} role="alert">
        Bạn không có quyền xét duyệt hồ sơ.
      </p>
    );
  const result = queue.kind === 'ready' ? queue.data : null;
  return (
    <>
      <p className={notice ? styles.notice : styles.visuallyHidden} role="status">
        {notice}
      </p>
      <div className={styles.layout} data-show-detail={Boolean(selectedId)}>
        <section
          className={styles.panel}
          aria-labelledby="verification-queue-title"
          data-panel="queue"
        >
          <div className={styles.queueHeader}>
            <h2 id="verification-queue-title" ref={queueHeading} tabIndex={-1}>
              Danh sách hồ sơ
            </h2>
            <label htmlFor="verification-filter">Trạng thái</label>
            <select
              id="verification-filter"
              value={filter}
              disabled={saving}
              onChange={(event) => {
                setFilter(event.target.value as VerificationFilter);
                setPage(1);
                setSelectedId(null);
                setNotice('');
                setQueue({ kind: 'loading' });
              }}
            >
              {filters.map(({ value, label }) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {queue.kind === 'loading' && (
            <p className={styles.loading} role="status">
              Đang tải danh sách…
            </p>
          )}
          {queue.kind === 'error' && (
            <div className={styles.state}>
              <p role="alert">{queue.message}</p>
              <button type="button" className={styles.secondaryButton} onClick={reloadQueue}>
                Thử lại
              </button>
            </div>
          )}
          {result && result.data.length === 0 && (
            <p className={styles.state}>
              {filter === 'PENDING' ? 'Không có hồ sơ chờ xét duyệt.' : 'Không có hồ sơ phù hợp.'}
            </p>
          )}
          {result && result.data.length > 0 && (
            <ul className={styles.queue}>
              {result.data.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    aria-label={'Xem hồ sơ của ' + record.displayName}
                    aria-pressed={selectedId === record.id}
                    disabled={saving}
                    onClick={() => {
                      setSelectedId(record.id);
                      setNotice('');
                    }}
                  >
                    <span className={styles.rowTop}>
                      <strong>{record.displayName}</strong>
                      <Status status={record.status} />
                    </span>
                    <span className={styles.email}>{record.schoolEmail}</span>
                    <time dateTime={record.submittedAt}>
                      {dateTime.format(new Date(record.submittedAt))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result && (
            <div className={styles.pagination} aria-label="Phân trang hồ sơ">
              <span role="status">
                {result.meta.total} hồ sơ
                {result.meta.totalPages > 0
                  ? ' · Trang ' + page + '/' + result.meta.totalPages
                  : ''}
              </span>
              {result.meta.totalPages > 1 && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving || page === 1}
                    onClick={() => {
                      setQueue({ kind: 'loading' });
                      setPage(page - 1);
                    }}
                  >
                    Trang trước
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving || page >= result.meta.totalPages}
                    onClick={() => {
                      setQueue({ kind: 'loading' });
                      setPage(page + 1);
                    }}
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <div data-panel="detail">
          {selectedId ? (
            <ReviewDetail
              key={selectedId}
              id={selectedId}
              client={client}
              onBack={goBack}
              onAccessError={onAccessError}
              onBusyChange={setSaving}
              onReviewed={(message) => {
                setNotice(message);
                reloadQueue();
              }}
            />
          ) : (
            <section className={styles.placeholder} aria-label="Chi tiết hồ sơ">
              <h2>Chọn hồ sơ để xem chi tiết</h2>
              <p>Thông tin sinh viên và thao tác xét duyệt sẽ hiển thị ở đây.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminVerificationPage({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  return (
    <MarketplaceShell client={client}>
      {session && (
        <>
          <header className={styles.heading}>
            <h1>Xét duyệt hồ sơ sinh viên</h1>
            <p>Xem hồ sơ xác minh và thông báo kết quả cho sinh viên.</p>
          </header>
          {session.user.role === 'ADMIN' ? (
            <ReviewQueue key={session.user.id} client={client} />
          ) : (
            <p className={styles.state} role="alert">
              Bạn không có quyền xét duyệt hồ sơ.
            </p>
          )}
        </>
      )}
    </MarketplaceShell>
  );
}
