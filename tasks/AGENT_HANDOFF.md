# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Phase 0 — Repository Bootstrap & Database Supabase Verification (Hoàn tất)
- **Cập nhật lần cuối:** 2026-11-01 22:22
- **Người bàn giao:** Senior Architect / Tech Lead AI Agent
- **Người tiếp nhận:** Frontend Team / Backend Team / Database Agent
- **Tình trạng Database:** Kết nối thành công tới Supabase PostgreSQL 17 (Pooler), xác nhận đủ 18/18 bảng baseline v1.2.
- **Tình trạng nhánh chính (`main`):** Pass toàn bộ Lint, Test, Typecheck, Build, sẵn sàng cho Phase 1.

---

## Lịch sử bàn giao (Handoff Log)

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
- **Lưu ý cho Agent tiếp theo:**
  - **Backend Agent:** Bắt đầu Phase 1 (Module Auth & OTP). Tuyệt đối không thay đổi schema trực tiếp trên Supabase. Nếu cần sửa schema, phải thảo luận và tạo file trong `database/migrations/`.
  - **Frontend Agent:** Bắt đầu Phase 1 (UI Đăng ký/Đăng nhập/OTP). Chỉ dùng endpoints có trong `packages/api-contract/openapi.yaml`. Sử dụng Apidog mock nếu backend endpoint chưa sẵn sàng.
