# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Foundation Audit & Core Integration (Giai đoạn 2 - Hoàn tất)
- **Cập nhật lần cuối:** 2026-11-03 13:42
- **Người bàn giao:** Senior Backend Engineer & Software Architect AI Agent
- **Người tiếp nhận:** Frontend Team / Backend Team / Database Agent
- **Branch hiện tại:** `fix/be-foundation-audit` (Sẵn sàng mở Pull Request vào `develop`)
- **Tình trạng Database:** Kết nối an toàn qua TLS Certificate Verification (`rejectUnauthorized: true`), xác nhận đủ 18/18 bảng baseline v1.2 trên Supabase PostgreSQL 17 Pooler.
- **Tình trạng kiểm thử:** PASS 100% (Backend Unit Tests, Backend E2E, Frontend Vitest, Lint, Typecheck, Build, Supabase DB Test).

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #003: Hoàn tất Foundation Audit & Đồng bộ Frontend-Backend (Giai đoạn 2)
- **Ngày:** 2026-11-03
- **Người thực hiện:** Senior Backend Engineer & Software Architect Agent
- **Branch:** `fix/be-foundation-audit`
- **Mục tiêu đạt được:** Khắc phục triệt để toàn bộ 6 phát hiện audit (AUDIT-01 -> AUDIT-06) theo đúng phê duyệt Giai đoạn 2.
- **Các nội dung đã hoàn thành:**
  1. **AUDIT-01 (Business Rules & PENDING Permissions):** Cập nhật `docs/business-rules/README.md`, chuẩn hóa endpoint hồ sơ `GET /me`, làm rõ giới hạn nghiêm ngặt của tài khoản `PENDING` (chỉ được xem feed tóm tắt `PendingFeedPage` qua `GET /feed`; bị chặn xem chi tiết bài đăng `GET /posts/{id}`, không được tìm kiếm/lọc, không được chat hay đăng bài).
  2. **AUDIT-02 (Student Evidence Confidentiality):** Sửa đổi dòng 114-118 trong `AGENTS.md` và tài liệu nghiệp vụ; xác định ảnh thẻ sinh viên là dữ liệu tối mật chỉ Admin mới có quyền truy cập qua signed URL (`GET /api/v1/admin/verifications/{id}`). Chủ sở hữu và người dùng thông thường không xem lại ảnh thẻ trên UI (`GET /me` loại bỏ `cardImageRef`).
  3. **AUDIT-03 (Frontend Response Envelope Unwrapping):** Cập nhật `apps/frontend/src/services/api.ts` định nghĩa `ApiEnvelope<T>`, `ApiErrorEnvelope`, `ApiError`; cơ chế tự động unwrap dữ liệu trong `request<T>()` giúp `api.getHealth()` trả về trực tiếp `HealthResponse` sạch. Bổ sung `api.getRawHealth()` và regression test trong `apps/frontend/src/test/App.test.tsx` kiểm thử bóc tách envelope và bắt lỗi HTTP `ApiError`.
  4. **AUDIT-04 (PostgreSQL TLS Security Enforced):** Sửa đổi `apps/backend/src/config/database.config.ts` và `apps/backend/src/database/test-connection.ts`: Enforce xác thực chứng chỉ TLS `rejectUnauthorized: true` mặc định cho toàn bộ kết nối PostgreSQL từ xa (kể cả dev). Cung cấp Supabase Root CA tại `database/supabase-ca.crt` với cơ chế nhận diện qua `PGSSL_CA` hoặc `PGSSL_CA_PATH`. Cập nhật `.env.example` và `apps/backend/.env.example`. Bổ sung bộ unit test `apps/backend/src/config/database.config.spec.ts`.
  5. **AUDIT-05 (API Contract Status Matrix):** Tạo `docs/api/api_implementation_status.md` phân loại tường minh toàn bộ 49 operations trong OpenAPI v1.2: 35 Core APIs, 14 Proposed Extensions và 1 Infrastructure Endpoint (`GET /health`).
  6. **AUDIT-06 (Thiết kế Kiến trúc Bổ sung):**
     - `docs/architecture/authorization_matrix.md`: Ma trận phân quyền chi tiết cho tất cả vai trò (`GUEST`, `PENDING`, `REJECTED`, `APPROVED`, `SUSPENDED`, `ADMIN`) trên toàn bộ 49 operations.
     - `docs/architecture/state_machines.md`: Thiết kế đầy đủ State Machines với Mermaid diagrams cho `verification_status`, `post_status`, `report_status` (sử dụng chính xác 6 DB enums: `SUBMITTED`, `WAITING_SELLER_RESPONSE`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED`, `NO_RESPONSE`), `conversation_status`, `attachment_status`.
     - `docs/api/integration_guide.md`: Cẩm nang tích hợp Frontend-Backend, chuẩn hóa Success/Error Envelope, phân trang, JWT header và unwrap pattern.
- **Kết quả kiểm thử thực tế:**
  - `apps/backend` Unit Tests (`jest`): **PASS** (3/3 suites, 12/12 tests, bao gồm `database.config.spec.ts`)
  - `apps/backend` E2E Tests (`jest --config ./test/jest-e2e.json`): **PASS** (1/1 suite, 2/2 tests)
  - `apps/frontend` Tests (`vitest run`): **PASS** (1/1 suite, 5/5 tests, bao gồm 3 regression tests cho Envelope)
  - `pnpm lint`: **PASS** (0 warnings across workspace)
  - `pnpm typecheck`: **PASS** (0 errors across workspace)
  - `pnpm build`: **PASS** (Biên dịch thành công cả backend và frontend)
  - `pnpm db:test`: **PASS** (Xác thực 18/18 bảng PostgreSQL trên Supabase Pooler qua TLS `rejectUnauthorized: true`)
- **Hướng dẫn cho Agent / Developer tiếp theo:**
  - Tiếp tục với Sprint 1: Bắt đầu triển khai Auth & OTP Module theo contract đã được đối chiếu trong `docs/api/api_implementation_status.md`.
  - Luôn sử dụng `GET /me` để truy vấn thông tin người dùng đăng nhập.
  - Mọi endpoint backend phải tiếp tục trả về thông qua `TransformInterceptor` để duy trì chuẩn Response Envelope.

---

### Handoff #002: Kết nối & Kiểm chứng CSDL Supabase
- **Ngày:** 2026-11-01
- **Người thực hiện:** Tech Lead Agent
- **Nội dung đã hoàn thành:**
  1. Tích hợp cấu hình SSL tự động thông minh cho PostgreSQL pool (`apps/backend/src/config/database.config.ts`) hỗ trợ Supabase pooler.
  2. Bổ sung script kiểm thử CSDL chuyên dụng `pnpm db:test` (`apps/backend/src/database/test-connection.ts`).
  3. Kết nối thực tế thành công tới Supabase PostgreSQL 17 (Region: `ap-southeast-1`).
  4. Quét và đối chiếu thông tin schema: **18/18 bảng Baseline v1.2** đều tồn tại nguyên vẹn trên schema `public`.
  5. Kiểm chứng endpoint `GET /api/v1/health` của NestJS Backend: Phản hồi `status: "ok"`, `database.status: "connected"`, độ trễ `latencyMs: ~300ms`.
- **Kết quả kiểm thử:**
  - `pnpm db:test`: PASS (18/18 bảng tồn tại)
  - `GET /api/v1/health`: PASS (`database.status: connected`)

---

### Handoff #001: Hoàn tất Bootstrap Monorepo (Phase 0)
- **Ngày:** 2026-11-01
- **Người thực hiện:** Senior Architect & Tech Lead Agent
- **Công việc đã thực hiện:**
  1. Khởi tạo cấu trúc pnpm workspace gồm `apps/frontend`, `apps/backend`, `packages/api-contract`, `database/`, `docs/`, `tasks/`.
  2. Tích hợp Baseline PostgreSQL DDL v1.2 (`database/baseline/schema_v1.2.sql`, 18 bảng nguyên vẹn).
  3. Tích hợp OpenAPI Contract v1.2 (`packages/api-contract/openapi.yaml`, 49 endpoints nguyên vẹn).
  4. Tạo quy chế hoạt động chi tiết cho AI Agent (`AGENTS.md` tại root, frontend, backend, database).
  5. Thiết lập Backend NestJS với endpoint `GET /health`, SQL-first repository layer kết nối Supabase qua `pg`.
  6. Thiết lập Frontend React + Vite + TypeScript với UI khởi động kết nối API Base URL.
  7. Cấu hình GitHub Actions CI chạy song song lint, typecheck, test, build.
- **Trạng thái kiểm thử:**
  - `pnpm lint`: PASS
  - `pnpm typecheck`: PASS
  - `pnpm test`: PASS
  - `pnpm build`: PASS
