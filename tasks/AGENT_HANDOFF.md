# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Phase 0 — Repository Bootstrap (Hoàn tất)
- **Cập nhật lần cuối:** 2026-11-01
- **Người bàn giao:** Senior Architect / Tech Lead AI Agent
- **Người tiếp nhận:** Frontend Team / Backend Team / Database Agent
- **Tình trạng nhánh chính (`main`):** Khởi tạo thành công, Monorepo sẵn sàng cho phát triển tính năng.

---

## Lịch sử bàn giao (Handoff Log)

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
  - **Backend Agent:** Tiếp tục với Phase 1 (Module Auth & OTP). Tuyệt đối không thay đổi schema trực tiếp trên Supabase. Nếu cần sửa schema, phải thảo luận và tạo file trong `database/migrations/`.
  - **Frontend Agent:** Bắt đầu với Phase 1 (UI Đăng ký/Đăng nhập/OTP). Chỉ dùng endpoints có trong `packages/api-contract/openapi.yaml`. Sử dụng Apidog mock nếu backend endpoint chưa sẵn sàng.

---

## Mẫu ghi nhận bàn giao cho các phiên tiếp theo

```markdown
### Handoff #XXX: [Mã Task] - [Tên Task]
- **Ngày:** YYYY-MM-DD
- **Người thực hiện:** [Role / Tên Agent]
- **Nhánh Git:** `feat/...` hoặc `fix/...`
- **Nội dung đã hoàn thành:**
  - ...
- **File bị thay đổi chính:**
  - ...
- **Kết quả kiểm thử:**
  - Test/Lint: PASS / FAIL
- **Ảnh hưởng Schema / API Contract:** Có / Không
- **Việc cần làm tiếp theo:**
  - ...
```
