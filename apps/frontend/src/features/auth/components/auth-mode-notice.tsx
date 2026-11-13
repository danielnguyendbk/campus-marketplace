import React from 'react';
import type { AuthMode } from '../types';
import { MOCK_EMAIL, MOCK_PASSWORD, MOCK_OTP_CODE } from '../mock-adapter';
import styles from '../auth.module.css';

export function AuthModeNotice({ mode }: { mode: AuthMode }) {
  if (mode !== 'mock') return null;
  return (
    <aside className={styles.mockNotice} aria-label="Chế độ mô phỏng">
      <strong>Bản mô phỏng · Không gửi email hoặc tạo tài khoản thật</strong>
      <details>
        <summary>Thông tin dùng thử</summary>
        <p>
          Chỉ nhập dữ liệu giả. Mã OTP thử: <strong>{MOCK_OTP_CODE}</strong>.
        </p>
        <p>
          Tài khoản mẫu: {MOCK_EMAIL} · Mật khẩu: {MOCK_PASSWORD}
        </p>
        <p>Dữ liệu chỉ giữ trong bộ nhớ, tải lại trang sẽ đặt lại bản mô phỏng.</p>
      </details>
    </aside>
  );
}
