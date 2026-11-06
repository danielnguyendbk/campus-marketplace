import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-logo" role="img" aria-label="Campus Icon">
          🎓
        </span>
        <div>
          <h1 className="brand-title">Campus Marketplace</h1>
          <p className="brand-subtitle">Nền tảng mua bán & tìm kiếm đồ dùng sinh viên (v1.2)</p>
        </div>
      </div>
      <div className="header-badge">
        <span className="status-pill status-ready">Phase 0: Bootstrap Sẵn sàng</span>
      </div>
    </header>
  );
};
