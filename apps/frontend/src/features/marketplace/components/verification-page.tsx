'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../api';
import {
  EVIDENCE_IMAGE_TYPES,
  EVIDENCE_MAX_BYTES,
  type EvidenceFields,
  type VerificationState,
} from '../types';
import { MarketplaceShell } from './marketplace-shell';
import styles from '../marketplace.module.css';

const initialFields: EvidenceFields = {
  school: '',
  major: '',
  className: '',
  studentCode: '',
  cohort: '',
  province: '',
};
const labels: Record<keyof EvidenceFields, string> = {
  school: 'Trường',
  major: 'Ngành',
  className: 'Lớp',
  studentCode: 'Mã sinh viên',
  cohort: 'Niên khóa',
  province: 'Tỉnh / thành phố',
};
const limits: Record<keyof EvidenceFields, number> = {
  school: 255,
  major: 255,
  className: 100,
  studentCode: 50,
  cohort: 50,
  province: 100,
};

const statusCopy = {
  PENDING: {
    label: 'Chờ xác thực',
    title: 'Hồ sơ đã được tiếp nhận',
    description: 'Bạn có thể xem bảng tin giới hạn trong khi chờ Admin xét duyệt.',
  },
  APPROVED: {
    label: 'Đã xác thực',
    title: 'Bạn đã được xác thực',
    description: 'Hồ sơ đã được Admin duyệt. Bạn có thể sử dụng Marketplace.',
  },
  REJECTED: {
    label: 'Cần bổ sung hồ sơ',
    title: 'Hồ sơ cần bổ sung',
    description: 'Cập nhật thông tin và chọn ảnh thẻ mới trước khi nộp lại.',
  },
  SUSPENDED: {
    label: 'Đình chỉ',
    title: 'Tài khoản bị đình chỉ',
    description: 'Quyền truy cập Marketplace bị hạn chế khi tài khoản đang bị đình chỉ.',
  },
};

const submittedDateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function VerificationStatusCard({
  state,
  submitting,
  onRefresh,
}: {
  state: VerificationState;
  submitting: boolean;
  onRefresh: () => void;
}) {
  const awaitingSubmission = state.status === 'PENDING' && !state.submittedAt;
  const status = awaitingSubmission
    ? {
        label: 'Chưa nộp hồ sơ',
        title: 'Hoàn thiện hồ sơ sinh viên',
        description: 'Điền thông tin và chọn ảnh thẻ sinh viên để gửi Admin xét duyệt.',
      }
    : statusCopy[state.status];
  const submittedDate = Date.parse(state.submittedAt ?? '');
  const canVisitFeed = state.status === 'PENDING' || state.status === 'APPROVED';

  return (
    <section
      className={styles.statusCard}
      data-status={state.status}
      aria-labelledby="verification-status-title"
    >
      <div className={styles.statusSummary}>
        <span className={styles.statusBadge}>{status.label}</span>
        <h2 id="verification-status-title">{status.title}</h2>
        <p>{status.description}</p>
        {Number.isFinite(submittedDate) && (
          <p className={styles.submittedDate}>
            Đã nộp:{' '}
            <time dateTime={state.submittedAt}>{submittedDateFormat.format(submittedDate)}</time>
          </p>
        )}
      </div>
      <div className={styles.statusActions}>
        {canVisitFeed && (
          <Link href="/" className={styles.statusLink}>
            {state.status === 'PENDING' ? 'Xem bảng tin giới hạn' : 'Về trang chủ'}
          </Link>
        )}
        <button
          type="button"
          className={styles.textButton}
          disabled={submitting}
          onClick={onRefresh}
        >
          Kiểm tra lại trạng thái
        </button>
      </div>
      {state.reason && <p className={styles.reason}>Lý do: {state.reason}</p>}
    </section>
  );
}

export function VerificationPage({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  const [state, setState] = useState<VerificationState | null>(null);
  const [fields, setFields] = useState(initialFields);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EvidenceFields | 'cardImage', string>>>(
    {},
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const upload = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const userId = session?.user.id;
  useEffect(
    () => () => {
      upload.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!userId) return;
    const request = new AbortController();
    setLoading(true);
    setError('');
    setState(null);
    void client
      .getVerification(request.signal)
      .then((result) => {
        if (!request.signal.aborted) setState(result);
      })
      .catch((failure) => {
        if (request.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) client.clearSession();
        setError(marketplaceError(failure));
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [client, userId, attempt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const next: typeof errors = {};
    for (const field of Object.keys(fields) as (keyof EvidenceFields)[]) {
      if ((field === 'school' || field === 'studentCode') && !fields[field].trim())
        next[field] = `Vui lòng nhập ${labels[field].toLowerCase()}.`;
      else if (fields[field].trim().length > limits[field])
        next[field] = `Tối đa ${limits[field]} ký tự.`;
    }
    if (!image || image.size === 0) next.cardImage = 'Vui lòng chọn ảnh thẻ sinh viên.';
    else if (!EVIDENCE_IMAGE_TYPES.includes(image.type.toLowerCase()))
      next.cardImage = 'Vui lòng chọn ảnh JPG, JPEG hoặc PNG.';
    else if (image.size > EVIDENCE_MAX_BYTES) next.cardImage = 'Ảnh vượt giới hạn 10 MB.';
    setErrors(next);
    setError('');
    setNotice('');
    const first = Object.keys(next)[0];
    if (first || !image) {
      (form.current?.elements.namedItem(first) as HTMLInputElement | null)?.focus();
      return;
    }
    busy.current = true;
    setSubmitting(true);
    const request = new AbortController();
    upload.current = request;
    try {
      const result = await client.submitEvidence(fields, image, request.signal);
      if (request.signal.aborted) return;
      setState(result);
      setImage(null);
      setFields(initialFields);
      if (input.current) input.current.value = '';
      setNotice('Đã nộp hồ sơ. Bạn có thể xem bảng tin giới hạn trong khi chờ Admin xét duyệt.');
    } catch (failure) {
      if (!request.signal.aborted) {
        if (failure instanceof ApiError && failure.status === 401) client.clearSession();
        setError(marketplaceError(failure));
      }
    } finally {
      busy.current = false;
      if (!request.signal.aborted) setSubmitting(false);
    }
  }
  const canSubmit = state?.status === 'PENDING' || state?.status === 'REJECTED';
  return (
    <MarketplaceShell client={client}>
      <header className={styles.pageHeading}>
        <h1>Hồ sơ xác thực sinh viên</h1>
        <p>Theo dõi xét duyệt và gửi minh chứng sinh viên.</p>
      </header>
      {loading ? (
        <div className={styles.verificationLoading} role="status">
          Đang tải trạng thái xác thực…
        </div>
      ) : !state ? (
        <div className={styles.state}>
          <h2>Chưa tải được hồ sơ</h2>
          <p role="alert">{error}</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className={styles.verificationContent}>
          <VerificationStatusCard
            state={state}
            submitting={submitting}
            onRefresh={() => {
              setNotice('');
              setAttempt((value) => value + 1);
            }}
          />
          {notice && (
            <p className={styles.successNotice} role="status">
              {notice}
            </p>
          )}
          {canSubmit && (
            <form
              ref={form}
              className={styles.verificationLayout}
              method="post"
              encType="multipart/form-data"
              noValidate
              onSubmit={submit}
              aria-busy={submitting}
            >
              <section className={styles.formCard} aria-labelledby="verification-fields-title">
                <h2 id="verification-fields-title">
                  {state.status === 'REJECTED' || state.submittedAt
                    ? 'Cập nhật và nộp lại hồ sơ'
                    : 'Thông tin sinh viên'}
                </h2>
                <p className={styles.muted}>
                  Các trường có dấu * là bắt buộc. Thông tin bổ sung giúp Admin đối chiếu hồ sơ.
                </p>
                <div className={styles.fieldGrid}>
                  {(Object.keys(fields) as (keyof EvidenceFields)[]).map((field) => (
                    <div className={styles.field} key={field}>
                      <label htmlFor={`evidence-${field}`}>
                        {labels[field]}
                        {field === 'school' || field === 'studentCode' ? ' *' : ''}
                      </label>
                      <input
                        id={`evidence-${field}`}
                        name={field}
                        value={fields[field]}
                        maxLength={limits[field]}
                        required={field === 'school' || field === 'studentCode'}
                        disabled={submitting}
                        aria-invalid={Boolean(errors[field])}
                        aria-describedby={errors[field] ? `error-${field}` : undefined}
                        onChange={(event) => {
                          setFields((current) => ({ ...current, [field]: event.target.value }));
                          setErrors((current) => ({ ...current, [field]: undefined }));
                        }}
                      />
                      {errors[field] && (
                        <p id={`error-${field}`} className={styles.fieldError}>
                          {errors[field]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section className={styles.formCard} aria-labelledby="verification-evidence-title">
                <h2 id="verification-evidence-title">Minh chứng sinh viên</h2>
                <div className={styles.upload}>
                  <label htmlFor="evidence-cardImage">Ảnh thẻ sinh viên *</label>
                  <div className={styles.filePicker}>
                    <input
                      ref={input}
                      id="evidence-cardImage"
                      name="cardImage"
                      type="file"
                      accept={EVIDENCE_IMAGE_TYPES.join(',')}
                      required
                      disabled={submitting}
                      aria-invalid={Boolean(errors.cardImage)}
                      aria-describedby={errors.cardImage ? 'image-help image-error' : 'image-help'}
                      onChange={(event) => {
                        setImage(event.target.files?.[0] ?? null);
                        setErrors((current) => ({ ...current, cardImage: undefined }));
                      }}
                    />
                    <span aria-hidden="true">{image ? 'Đổi ảnh thẻ' : 'Chọn ảnh thẻ'}</span>
                  </div>
                  {image && <p className={styles.fileName}>Tệp đã chọn: {image.name}</p>}
                  <p id="image-help" className={styles.muted}>
                    JPG, JPEG hoặc PNG, tối đa 10 MB.
                  </p>
                  {errors.cardImage && (
                    <p id="image-error" className={styles.fieldError}>
                      {errors.cardImage}
                    </p>
                  )}
                </div>
                <p className={styles.privacyNote}>
                  Chỉ Admin được xem ảnh khi xét duyệt.{' '}
                  {client.mode === 'mock' && 'Trong bản mô phỏng, hãy dùng ảnh giả.'}
                </p>
                {error && (
                  <p className={styles.errorNotice} role="alert">
                    {error}
                  </p>
                )}
                <button
                  className={`${styles.primaryButton} ${styles.evidenceSubmit}`}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Đang nộp hồ sơ…' : 'Nộp hồ sơ xác thực'}
                </button>
              </section>
            </form>
          )}
        </div>
      )}
    </MarketplaceShell>
  );
}
