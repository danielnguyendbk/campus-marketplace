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
const summaryStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
const filters: { value: VerificationFilter; label: string }[] = [
  ...summaryStatuses.map((value) => ({ value, label: statusLabels[value] })),
  { value: 'ALL', label: 'Tất cả hồ sơ' },
];
type CountSeed = { revision: number; filter: VerificationFilter };
type VerificationCounts = Partial<Record<VerificationStatus, number>>;
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
    <section className={styles.evidence} aria-labelledby="verification-evidence-title">
      <h3 id="verification-evidence-title">Ảnh minh chứng</h3>
      <p className={styles.evidencePrivacy}>Chỉ quản trị viên có quyền xem ảnh này.</p>
      <div className={styles.evidenceFrame}>
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
          <div className={styles.evidenceError}>
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
          </div>
        )}
      </div>
    </section>
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
          <div className={styles.detailGrid}>
            <section className={styles.infoCard} aria-labelledby="verification-info-title">
              <h3 id="verification-info-title">Thông tin sinh viên</h3>
              <div className={styles.profile}>
                <div>
                  <h4>{record.displayName}</h4>
                  <p>{record.schoolEmail}</p>
                </div>
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
            </section>
            <EvidencePreview record={record} client={client} onAccessError={onAccessError} />
          </div>
          {record.status === 'PENDING' && (
            <section
              className={styles.decision}
              data-decision={decision ?? undefined}
              aria-label="Quyết định xét duyệt"
            >
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
                        Lý do sẽ hiển thị cho sinh viên. {reason.length}/
                        {VERIFICATION_REASON_MAX_LENGTH} ký tự.
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
                <div className={styles.decisionBar}>
                  <h3>Quyết định xét duyệt</h3>
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
                      className={styles.rejectButton}
                      onClick={() => setDecision('REJECTED')}
                    >
                      Từ chối
                    </button>
                  </div>
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
  const [countSeed, setCountSeed] = useState<CountSeed | null>(null);
  const [counts, setCounts] = useState<VerificationCounts>({});
  const [countError, setCountError] = useState(false);
  const [retryCountStatuses, setRetryCountStatuses] = useState<VerificationStatus[] | null>(null);
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
        if (filter !== 'ALL') {
          setCounts((current) => ({ ...current, [filter]: data.meta.total }));
        }
        setCountSeed((current) =>
          current?.revision === revision ? current : { revision, filter },
        );
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !onAccessError(error))
          setQueue({ kind: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [client, filter, page, revision, forbidden, onAccessError]);

  useEffect(() => {
    if (!countSeed || forbidden) return;
    const controller = new AbortController();
    const { signal } = controller;
    setCountError(false);

    for (const status of retryCountStatuses ?? summaryStatuses) {
      if (status === countSeed.filter) continue;
      void client.listAdminVerifications(status, 1, signal, 1).then(
        ({ meta }) => {
          if (!signal.aborted) {
            setCounts((current) =>
              current[status] === undefined ? { ...current, [status]: meta.total } : current,
            );
          }
        },
        (failure: unknown) => {
          if (signal.aborted) return;
          if (onAccessError(failure)) controller.abort();
          else setCountError(true);
        },
      );
    }
    return () => controller.abort();
  }, [client, countSeed, retryCountStatuses, forbidden, onAccessError]);

  useEffect(() => {
    if (selectedId === null && focusQueue.current) {
      focusQueue.current = false;
      queueHeading.current?.focus();
    }
  }, [selectedId]);

  function reloadQueue() {
    setQueue({ kind: 'loading' });
    setCountSeed(null);
    setCounts({});
    setCountError(false);
    setRetryCountStatuses(null);
    setRevision((value) => value + 1);
  }

  function goBack() {
    focusQueue.current = true;
    setSelectedId(null);
  }

  function changeFilter(next: VerificationFilter) {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
    setSelectedId(null);
    setNotice('');
    setQueue({ kind: 'loading' });
  }

  if (forbidden)
    return (
      <p className={styles.state} role="alert">
        Bạn không có quyền xét duyệt hồ sơ.
      </p>
    );
  const result = queue.kind === 'ready' ? queue.data : null;
  const missingCounts = summaryStatuses.filter((status) => counts[status] === undefined);
  return (
    <>
      <p className={notice ? styles.notice : styles.visuallyHidden} role="status">
        {notice}
      </p>
      <div className={styles.layout}>
        {!selectedId && (
          <div>
            <dl className={styles.statistics} aria-label="Thống kê hồ sơ xác thực">
              {summaryStatuses.map((status) => (
                <div className={styles.statCard} data-status={status} key={status}>
                  <dt>{statusLabels[status]}</dt>
                  <dd>{counts[status] ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {countError && missingCounts.length > 0 && (
              <div className={styles.summaryError}>
                <p role="status">Chưa tải được đầy đủ số liệu.</p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setRetryCountStatuses(missingCounts)}
                >
                  Tải lại số liệu
                </button>
              </div>
            )}
          </div>
        )}
        <section
          className={styles.panel}
          aria-labelledby="verification-queue-title"
          hidden={Boolean(selectedId)}
        >
          <div className={styles.queueHeader}>
            <h2 id="verification-queue-title" ref={queueHeading} tabIndex={-1}>
              Danh sách hồ sơ
            </h2>
            <div className={styles.filterBar} role="group" aria-label="Lọc theo trạng thái">
              {filters.map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  disabled={saving}
                  onClick={() => changeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.mobileFilter}>
              <label htmlFor="verification-filter">Trạng thái</label>
              <select
                id="verification-filter"
                value={filter}
                disabled={saving}
                onChange={(event) => changeFilter(event.target.value as VerificationFilter)}
              >
                {filters.map(({ value, label }) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
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
          {result && result.data.length > 0 && !selectedId && (
            <table className={styles.queue} aria-labelledby="verification-queue-title">
              <thead>
                <tr>
                  <th scope="col" className={styles.idColumn}>
                    Mã hồ sơ
                  </th>
                  <th scope="col" className={styles.studentCell}>
                    Sinh viên
                  </th>
                  <th scope="col" className={styles.schoolColumn}>
                    Trường / MSSV
                  </th>
                  <th scope="col" className={styles.dateColumn}>
                    Ngày nộp
                  </th>
                  <th scope="col" className={styles.statusColumn}>
                    Trạng thái
                  </th>
                  <th scope="col" className={styles.actionColumn}>
                    Hồ sơ
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((record) => {
                  const submittedAt = dateTime.format(new Date(record.submittedAt));
                  return (
                    <tr key={record.id}>
                      <td className={styles.idColumn}>
                        <code title={record.id}>{record.id.slice(0, 8).toUpperCase()}…</code>
                      </td>
                      <td className={styles.studentCell}>
                        <strong>{record.displayName}</strong>
                        <span>{record.schoolEmail}</span>
                        <time className={styles.mobileDate} dateTime={record.submittedAt}>
                          Nộp {submittedAt}
                        </time>
                      </td>
                      <td className={styles.schoolColumn}>
                        {record.school || 'Chưa cung cấp'}
                        {record.studentCode && (
                          <span className={styles.studentCode}>{record.studentCode}</span>
                        )}
                      </td>
                      <td className={styles.dateColumn}>
                        <time dateTime={record.submittedAt}>{submittedAt}</time>
                      </td>
                      <td>
                        <Status status={record.status} />
                      </td>
                      <td className={styles.actionColumn}>
                        <button
                          className={styles.queueAction}
                          data-status={record.status}
                          type="button"
                          aria-label={'Xem hồ sơ của ' + record.displayName}
                          disabled={saving}
                          onClick={() => {
                            setSelectedId(record.id);
                            setNotice('');
                          }}
                        >
                          Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        {selectedId && (
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
        )}
      </div>
    </>
  );
}

export function AdminVerificationPage({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  return (
    <MarketplaceShell client={client} adminArea>
      {session && (
        <div className={styles.workspace}>
          <header className={styles.heading}>
            <h1>Xác thực sinh viên</h1>
            <p>Kiểm tra và xét duyệt hồ sơ đăng ký.</p>
          </header>
          {session.user.role === 'ADMIN' ? (
            <ReviewQueue key={session.user.id} client={client} />
          ) : (
            <p className={styles.state} role="alert">
              Bạn không có quyền xét duyệt hồ sơ.
            </p>
          )}
        </div>
      )}
    </MarketplaceShell>
  );
}
