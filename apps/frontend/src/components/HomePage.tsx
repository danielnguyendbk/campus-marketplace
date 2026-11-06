'use client';

import React from 'react';
import { Header } from './Header';
import { StatusCard } from './StatusCard';
import { useApiHealth } from '../hooks/useApiHealth';
import { API_BASE_URL } from '../services/api';

export const HomePage: React.FC = () => {
  const { data: health, loading, error, refetch } = useApiHealth();

  return (
    <div className="home-container">
      <Header />

      <main className="dashboard-grid">
        <section className="dashboard-section intro-section">
          <h2>Chào mừng đến với Campus Marketplace Monorepo</h2>
          <p>
            Hệ thống đã hoàn tất <strong>Phase 0 — Repository Bootstrap</strong>. Cấu trúc monorepo
            pnpm, baseline PostgreSQL v1.2 (18 bảng), hợp đồng OpenAPI 3.x (49 endpoints) và các quy
            chế <code>AGENTS.md</code> đã được cấu hình chặt chẽ.
          </p>
        </section>

        <section className="status-grid">
          <StatusCard
            title="Frontend Application"
            status="success"
            description="Ứng dụng Next.js 14+ (App Router) + TypeScript khởi động thành công."
            details={{
              Gói: '@campus/frontend',
              'Công nghệ': 'Next.js 14, React 18, Vitest',
              'API Base URL': API_BASE_URL,
            }}
          />

          <StatusCard
            title="Backend Health Status"
            status={error ? 'warning' : loading ? 'info' : 'success'}
            description={
              loading
                ? 'Đang kiểm tra kết nối tới Backend API...'
                : error
                  ? `Chưa kết nối Backend: ${error} (Bình thường nếu chưa chạy pnpm dev / backend)`
                  : 'Backend NestJS đang phản hồi bình thường.'
            }
            details={{
              Endpoint: `${API_BASE_URL}/health`,
              'Trạng thái': loading
                ? 'Đang tải...'
                : error
                  ? 'Chưa phản hồi'
                  : health?.status || 'OK',
              Database: health?.database?.status || 'N/A',
              Uptime: health?.uptime ? `${Math.floor(health.uptime)}s` : 'N/A',
            }}
          />

          <StatusCard
            title="Database Foundation"
            status="info"
            description="PostgreSQL v1.2 trên Supabase với 18 bảng nghiệp vụ đã sẵn sàng."
            details={{
              Baseline: 'database/baseline/schema_v1.2.sql',
              'Số bảng': 18,
              'Truy xuất': 'pg pool (SQL-first repository)',
              'Trạng thái': 'Đã đồng bộ baseline',
            }}
          />

          <StatusCard
            title="API Contract (OpenAPI 3.x)"
            status="info"
            description="49 endpoints được thiết kế trên Apidog đồng bộ hai chiều."
            details={{
              Gói: '@campus/api-contract',
              'Phiên bản': 'v1.2.0-draft',
              'Cốt lõi': '35 endpoints',
              'Đề xuất mở rộng': '14 endpoints',
            }}
          />
        </section>

        <section className="actions-section">
          <button className="btn-primary" onClick={refetch} disabled={loading}>
            {loading ? 'Đang kiểm tra...' : '🔄 Kiểm tra lại kết nối Backend'}
          </button>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Campus Marketplace Monorepo &bull; Next.js 14 App Router &bull; Node.js 20.20.1 &bull;
          pnpm 10.14.0
        </p>
      </footer>
    </div>
  );
};
