import React from 'react';
import Link from 'next/link';
import type { AuthSession, VerificationStatus } from '../types';
import styles from '../auth.module.css';

export function SessionResult({
  session,
  registered = false,
  onReset,
}: {
  session: AuthSession;
  registered?: boolean;
  onReset?: () => void;
}) {
  const notices: Record<VerificationStatus, string> = {
    PENDING:
      'Tài khoản đang ở trạng thái chờ xác thực sinh viên. Bạn cần hoàn thiện hồ sơ và được duyệt để sử dụng đầy đủ Marketplace.',
    APPROVED: 'Tài khoản sinh viên của bạn đã được xác thực.',
    REJECTED: 'Hồ sơ xác thực sinh viên chưa được duyệt. Bạn cần cập nhật và nộp lại hồ sơ.',
    SUSPENDED: 'Tài khoản của bạn đang bị đình chỉ.',
  };
  return (
    <div className={styles.success} role="status" aria-live="polite">
      <span className={styles.successIcon} aria-hidden="true">
        ✓
      </span>
      <p className={styles.kicker}>
        {registered ? 'CHÀO MỪNG THÀNH VIÊN MỚI' : 'KẾT NỐI THÀNH CÔNG'}
      </p>
      <h2 className={styles.formTitle}>
        {registered ? 'Tạo tài khoản thành công!' : `Chào ${session.user.displayName}!`}
      </h2>
      <p className={styles.formDescription}>
        {registered
          ? `Chào ${session.user.displayName}, cùng tiếp nối giá trị cho những món đồ nhé.`
          : 'Bạn đã đăng nhập thành công.'}
      </p>
      <p className={styles.sessionNotice}>{notices[session.user.verificationStatus]}</p>
      {registered ? (
        <Link href="/verification" className={styles.buttonLink}>
          Hoàn thiện hồ sơ sinh viên
        </Link>
      ) : (
        <>
          <Link
            href={session.user.verificationStatus === 'REJECTED' ? '/verification' : '/'}
            className={styles.buttonLink}
          >
            Tiếp tục
          </Link>
          <button className={styles.secondaryButton} type="button" onClick={onReset}>
            Đăng nhập tài khoản khác
          </button>
        </>
      )}
    </div>
  );
}
