import React from 'react';
import styles from '../../features/auth/auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/login" aria-label="Campus Marketplace — Đăng nhập">
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
            campus<span className={styles.brandSuffix}>marketplace</span>
          </span>
        </a>
        <span className={styles.headerNote}>Kết nối sinh viên. Tiếp nối giá trị.</span>
      </header>

      <main className={styles.main}>
        <section className={styles.introduction} aria-labelledby="campus-introduction">
          <div className={styles.introContent}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" /> DÀNH CHO CỘNG ĐỒNG SINH VIÊN
            </p>
            <h1 id="campus-introduction" className={styles.headline}>
              Đồ cũ.
              <br /> Giá trị <span>mới.</span>
            </h1>
            <p className={styles.introDescription}>
              Cuốn sách đã đọc, chiếc bàn còn tốt.
              <br />
              Kết nối để những món đồ tìm được người cần.
            </p>
          </div>

          <div className={styles.illustration} aria-hidden="true">
            <span className={styles.orbit} />
            <span className={styles.orbitSmall} />
            <svg className={styles.objects} viewBox="0 0 520 310" fill="none">
              <ellipse cx="267" cy="271" rx="195" ry="17" fill="#111A33" />
              <g transform="rotate(-9 136 205)">
                <rect x="60" y="201" width="156" height="43" rx="6" fill="#F4B400" />
                <path d="M76 209h130v26H76z" fill="#FFF3CD" />
                <path d="M82 217h117M82 225h117" stroke="#DBCBA8" strokeWidth="2" />
                <rect x="70" y="150" width="137" height="51" rx="5" fill="#8FA9D5" />
                <path d="M84 160h113v30H84z" fill="#ECF1FA" />
                <path d="M89 171h101M89 179h101" stroke="#C6D1E4" strokeWidth="2" />
                <path d="M157 150v24l10-6 10 6v-24" fill="#F9C94E" />
              </g>
              <g transform="rotate(5 323 181)">
                <rect x="210" y="90" width="219" height="145" rx="11" fill="#526885" />
                <rect x="219" y="99" width="201" height="126" rx="5" fill="#DDE7F6" />
                <rect x="232" y="112" width="175" height="100" rx="3" fill="#F6F8FC" />
                <rect x="246" y="129" width="59" height="65" rx="5" fill="#E3EAF5" />
                <path d="m257 170 15-17 14 13 9-9v27h-38v-14Z" fill="#8FA9D5" />
                <circle cx="287" cy="144" r="6" fill="#F4B400" />
                <path
                  d="M319 137h62M319 148h48M319 159h55"
                  stroke="#BECBE0"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <rect x="316" y="174" width="57" height="19" rx="5" fill="#F4B400" />
                <path
                  d="M195 235h250l-15 15a11 11 0 0 1-8 3H218a11 11 0 0 1-8-3l-15-15Z"
                  fill="#A9BBD5"
                />
                <path d="M292 235h57l-4 5h-49l-4-5Z" fill="#7189AA" />
              </g>
              <g transform="rotate(12 409 191)">
                <path d="M378 198v-40a37 37 0 0 1 74 0v40" stroke="#F8CD5B" strokeWidth="13" />
                <rect x="366" y="178" width="25" height="54" rx="12" fill="#F4B400" />
                <rect x="438" y="178" width="25" height="54" rx="12" fill="#F4B400" />
                <rect x="381" y="181" width="12" height="47" rx="6" fill="#D18F00" />
                <rect x="436" y="181" width="12" height="47" rx="6" fill="#D18F00" />
              </g>
              <path d="m107 94 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="#F4B400" />
              <path d="m438 63 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#8FA9D5" />
              <circle cx="177" cy="74" r="4" fill="#8FA9D5" />
              <circle cx="474" cy="248" r="4" fill="#F4B400" />
            </svg>
            <span className={styles.reuseLabel}>
              <svg viewBox="0 0 20 20" fill="none">
                <path
                  d="m13 3 3 3-3 3M16 6H7a4 4 0 0 0-4 4m4 7-3-3 3-3m-3 3h9a4 4 0 0 0 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Thêm một vòng đời, thêm nhiều giá trị
            </span>
          </div>

          <div className={styles.introFooter}>
            <span>Email trường</span>
            <span>Tiết kiệm hơn</span>
            <span>Sống xanh hơn</span>
          </div>
        </section>

        <section className={styles.formPanel} aria-label="Tài khoản sinh viên">
          <div className={styles.formContent}>{children}</div>
          <p className={styles.panelNote}>
            Một cộng đồng nhỏ.
            <br />
            Những giá trị được sẻ chia.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Campus Marketplace</span>
        <span>Nền tảng mua bán &amp; tìm mua đồ dùng dành cho sinh viên</span>
      </footer>
    </div>
  );
}
