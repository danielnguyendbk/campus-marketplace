'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../api';
import { EVIDENCE_MAX_BYTES, type EvidenceFields, type VerificationState } from '../types';
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
    else if (!image.type.startsWith('image/')) next.cardImage = 'Vui lòng chọn một tệp ảnh.';
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
  const canSubmit = state && ['PENDING', 'REJECTED'].includes(state.status);
  return (
    <MarketplaceShell client={client}>
      <div className={styles.pageHeading}>
        <p className={styles.eyebrow}>THÊM MỘT BƯỚC ĐỂ KẾT NỐI</p>
        <h1>Hồ sơ xác thực sinh viên</h1>
        <p>Xác thực email là bước đầu. Hoàn thiện hồ sơ để Admin xác nhận bạn là sinh viên.</p>
      </div>
      {loading ? (
        <p role="status">Đang tải trạng thái xác thực…</p>
      ) : !state ? (
        <div className={styles.state}>
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
        <div className={styles.verificationLayout}>
          <aside className={styles.statusCard}>
            <span className={styles.statusBadge}>
              {state.status === 'PENDING'
                ? 'Chờ xác thực'
                : state.status === 'APPROVED'
                  ? 'Đã xác thực'
                  : state.status === 'REJECTED'
                    ? 'Cần bổ sung hồ sơ'
                    : 'Tài khoản bị đình chỉ'}
            </span>
            <h2>
              {state.status === 'APPROVED'
                ? 'Bạn đã được xác thực'
                : state.submittedAt
                  ? 'Hồ sơ đã được tiếp nhận'
                  : 'Hoàn thiện thông tin của bạn'}
            </h2>
            <p>
              {state.status === 'APPROVED'
                ? 'Hồ sơ đã được Admin duyệt. Ảnh thẻ và minh chứng không hiển thị lại tại đây.'
                : state.status === 'REJECTED'
                  ? 'Vui lòng kiểm tra lý do và nộp lại hồ sơ để được xét duyệt.'
                  : 'Trong thời gian chờ duyệt, bạn vẫn có thể xem bảng tin giới hạn.'}
            </p>
            {state.reason && <p className={styles.reason}>Lý do: {state.reason}</p>}
            {state.submittedAt && (
              <p>
                Đã nộp:{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'medium',
                  timeZone: 'Asia/Ho_Chi_Minh',
                }).format(new Date(state.submittedAt))}
              </p>
            )}
            {['PENDING', 'APPROVED'].includes(state.status) && (
              <Link href="/" className={styles.primaryLink}>
                {state.status === 'PENDING' ? 'Xem bảng tin giới hạn' : 'Về trang chủ'}{' '}
                <span aria-hidden="true">→</span>
              </Link>
            )}
            <button
              type="button"
              className={styles.textButton}
              disabled={submitting}
              onClick={() => {
                setNotice('');
                setAttempt((value) => value + 1);
              }}
            >
              Kiểm tra lại trạng thái
            </button>
          </aside>
          <div className={styles.formCard}>
            {notice && (
              <p className={styles.successNotice} role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className={styles.errorNotice} role="alert">
                {error}
              </p>
            )}
            {canSubmit ? (
              <>
                <h2>{state.submittedAt ? 'Cập nhật và nộp lại hồ sơ' : 'Thông tin sinh viên'}</h2>
                <p className={styles.muted}>
                  Trường, mã sinh viên và ảnh thẻ là bắt buộc. Bạn có thể bổ sung các thông tin còn
                  lại để hỗ trợ xét duyệt.
                </p>
                <form
                  ref={form}
                  method="post"
                  encType="multipart/form-data"
                  noValidate
                  onSubmit={submit}
                  aria-busy={submitting}
                >
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
                  <div className={styles.upload}>
                    <label htmlFor="evidence-cardImage">Ảnh thẻ sinh viên *</label>
                    <input
                      ref={input}
                      id="evidence-cardImage"
                      name="cardImage"
                      type="file"
                      accept="image/*"
                      required
                      disabled={submitting}
                      aria-invalid={Boolean(errors.cardImage)}
                      aria-describedby="image-help image-error"
                      onChange={(event) => {
                        setImage(event.target.files?.[0] ?? null);
                        setErrors((current) => ({ ...current, cardImage: undefined }));
                      }}
                    />
                    <p id="image-help">
                      Tối đa 10 MB. Ảnh chỉ phục vụ Admin xét duyệt, không hiển thị lại sau khi nộp.
                      Trong bản mô phỏng, chỉ chọn ảnh giả.
                    </p>
                    <p id="image-error" className={styles.fieldError}>
                      {errors.cardImage}
                    </p>
                  </div>
                  <button className={styles.primaryButton} type="submit" disabled={submitting}>
                    {submitting ? 'Đang nộp hồ sơ…' : 'Nộp hồ sơ xác thực'}
                  </button>
                </form>
              </>
            ) : (
              <p>Thông tin minh chứng được bảo vệ và không hiển thị trên trang này.</p>
            )}
          </div>
        </div>
      )}
    </MarketplaceShell>
  );
}
