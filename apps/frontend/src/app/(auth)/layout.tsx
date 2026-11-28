import React from 'react';
import Link from 'next/link';
import styles from '../../features/auth/auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.introduction}>
          <Link className={styles.brand} href="/login" aria-label="Campus Marketplace — Đăng nhập">
            <span className={styles.brandMark} aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="m5 12 11-6 11 6-11 6-11-6Z" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M9 15v7c4 3 10 3 14 0v-7M27 12v9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              Campus<span className={styles.brandSuffix}>Marketplace</span>
            </span>
          </Link>
          <div className={styles.introContent}>
            <p className={styles.headline}>Đồ cũ, giá trị mới.</p>
            <p className={styles.introDescription}>
              Mua, bán và tìm đồ dùng trong cộng đồng sinh viên đã xác thực.
            </p>
          </div>
          <div className={styles.illustration} aria-hidden="true">
            <svg className={styles.objects} viewBox="0 0 520 310" fill="none">
              <ellipse cx="267" cy="271" rx="195" ry="17" fill="var(--campus-primary-hover)" />
              <g transform="rotate(-9 136 205)">
                <rect x="60" y="201" width="156" height="43" rx="6" fill="var(--art-accent)" />
                <path d="M76 209h130v26H76z" fill="var(--campus-surface)" />
                <path d="M82 217h117M82 225h117" stroke="var(--art-line)" strokeWidth="2" />
                <rect x="70" y="150" width="137" height="51" rx="5" fill="var(--art-blue)" />
                <path d="M84 160h113v30H84z" fill="var(--campus-surface)" />
                <path d="M89 171h101M89 179h101" stroke="var(--art-line)" strokeWidth="2" />
                <path d="M157 150v24l10-6 10 6v-24" fill="var(--art-accent)" />
              </g>
              <g transform="rotate(5 323 181)">
                <rect x="210" y="90" width="219" height="145" rx="11" fill="var(--art-frame)" />
                <rect x="219" y="99" width="201" height="126" rx="5" fill="var(--campus-surface)" />
                <rect x="232" y="112" width="175" height="100" rx="3" fill="#fff" />
                <rect x="246" y="129" width="59" height="65" rx="5" fill="var(--campus-surface)" />
                <path d="m257 170 15-17 14 13 9-9v27h-38v-14Z" fill="var(--art-blue)" />
                <circle cx="287" cy="144" r="6" fill="var(--art-accent)" />
                <path
                  d="M319 137h62M319 148h48M319 159h55"
                  stroke="var(--art-line)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <rect x="316" y="174" width="57" height="19" rx="5" fill="var(--art-accent)" />
                <path
                  d="M195 235h250l-15 15a11 11 0 0 1-8 3H218a11 11 0 0 1-8-3l-15-15Z"
                  fill="var(--art-blue)"
                />
                <path d="M292 235h57l-4 5h-49l-4-5Z" fill="var(--art-frame)" />
              </g>
              <g transform="rotate(12 409 191)">
                <path
                  d="M378 198v-40a37 37 0 0 1 74 0v40"
                  stroke="var(--art-accent)"
                  strokeWidth="13"
                />
                <rect x="366" y="178" width="25" height="54" rx="12" fill="var(--art-accent)" />
                <rect x="438" y="178" width="25" height="54" rx="12" fill="var(--art-accent)" />
                <rect x="381" y="181" width="12" height="47" rx="6" fill="var(--campus-success)" />
                <rect x="436" y="181" width="12" height="47" rx="6" fill="var(--campus-success)" />
              </g>
              <path d="m107 94 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="var(--art-accent)" />
              <path d="m438 63 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="var(--art-blue)" />
              <circle cx="177" cy="74" r="4" fill="var(--art-blue)" />
              <circle cx="474" cy="248" r="4" fill="var(--art-accent)" />
            </svg>
          </div>
        </div>

        <section className={styles.formPanel} aria-label="Tài khoản sinh viên">
          <div className={styles.formContent}>{children}</div>
        </section>
      </main>
    </div>
  );
}
