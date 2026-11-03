# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Foundation Audit & Strict Contract Alignment (PR #1 Final Polish - Hoàn tất)
- **Cập nhật lần cuối:** 2026-11-03 16:25
- **Người bàn giao:** Senior Backend Engineer & Software QA Specialist AI Agent
- **Người tiếp nhận:** Frontend Team / Backend Team / Database Agent / Reviewer
- **Branch hiện tại:** `fix/be-foundation-audit` (PR #1 nhắm vào `develop`, không tạo PR mới, không merge)
- **Tình trạng Database:** Kết nối an toàn qua TLS Certificate Verification (`rejectUnauthorized: true` bắt buộc tuyệt đối cho remote/Supabase DB), xác nhận đủ 18/18 bảng baseline v1.2 trên Supabase PostgreSQL 17 Pooler.
- **Tình trạng kiểm thử:** PASS 100% (Backend Unit Tests 20/20, Backend E2E 6/6, Frontend Vitest 15/15, Lint 0 warnings, Typecheck 0 errors, Build thành công).

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #005: Khắc phục Triệt để Schema ErrorEnvelope (additionalProperties: false) & An toàn Lỗi 500
- **Ngày:** 2026-11-03
- **Người thực hiện:** Senior Backend Engineer & Software QA Specialist
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Đối chiếu và Chuẩn hóa Error Envelope theo OpenAPI v1.2:**
     - Loại bỏ toàn bộ các trường dư thừa ở top-level (`success`, `statusCode`, `timestamp`, `path`, root `message`) vốn vi phạm ràng buộc `additionalProperties: false` của schema `ErrorEnvelope`.
     - Phản hồi lỗi chỉ chứa duy nhất `error: { code, message, details? }` và `requestId` (tùy chọn). Mã HTTP status được trả qua HTTP header chuẩn.
     - Cập nhật `apps/backend/src/common/interfaces/api-response.interface.ts` và `apps/backend/src/common/filters/http-exception.filter.ts`.
     - Bổ sung bộ contract tests E2E chuyên sâu `apps/backend/test/error-envelope.e2e-spec.ts` kiểm chứng trực tiếp tính tương thích với OpenAPI `ErrorEnvelope`.
  2. **Bảo mật Tối đa Lỗi Máy chủ (HTTP 500 - Security Directives):**
     - Sửa `AllExceptionsFilter`: Mọi lỗi không phải `HttpException` (lỗi PostgreSQL, lỗi crash runtime, `TypeError`) đều trả về HTTP 500 với thông điệp công khai an toàn: `code: "INTERNAL_SERVER_ERROR"`, `message: "Internal server error"`, không trả `details`.
     - Tuyệt đối không để lộ `exception.message`, connection string, thông tin tài khoản Supabase hay stack trace ra ngoài response JSON. Toàn bộ chi tiết được ghi an toàn vào server logs.
     - Bổ sung regression tests trong `apps/backend/src/common/filters/http-exception.filter.spec.ts` và `apps/backend/test/error-envelope.e2e-spec.ts` mô phỏng lỗi kết nối PostgreSQL chứa mật khẩu nhạy cảm và lỗi runtime `TypeError`.
  3. **Đồng bộ Frontend & Tài liệu Kỹ thuật:**
     - Cập nhật mock trong `apps/frontend/src/test/api.test.ts` và `apps/frontend/src/test/App.test.tsx` khớp 100% với schema `ErrorEnvelope`.
     - Cập nhật `docs/api/integration_guide.md` và `AGENTS.md` (DoD).
- **Kết quả kiểm thử thực tế:**
  - `pnpm --filter @campus/backend test`: **PASS** (4 suites, 20/20 tests passed).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (2 suites, 6/6 tests passed).
  - `pnpm --filter @campus/frontend test`: **PASS** (2 suites, 15/15 tests passed).
  - `pnpm lint`: **PASS** (0 warnings across workspace).
  - `pnpm typecheck`: **PASS** (0 errors across workspace).
  - `pnpm build`: **PASS** (Frontend và Backend biên dịch thành công).

### Handoff #004: Tinh chỉnh Toàn diện & Đồng bộ Nghiệp vụ PR #1
- **Ngày:** 2026-11-03
- **Người thực hiện:** Senior Backend Engineer & Software QA Specialist
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:** Hoàn thành 6 yêu cầu kỹ thuật & kiểm toán khắt khe trên PR #1 mà không tạo PR mới hay tự merge.
- **Các nội dung đã hoàn thành:**
  1. **Strict Envelope Validation (`ApiClient.request<T>`):**
     - Sửa `apps/frontend/src/services/api.ts`: Bắt buộc response HTTP 2xx phải tuân thủ nghiêm ngặt `{ success: true, data, timestamp }`.
     - Tuyệt đối không fallback trả về payload dạng phẳng hay `null`. Ném `ApiError` với mã `INVALID_RESPONSE_ENVELOPE` hoặc `INVALID_JSON`.
     - Bổ sung file test chuyên dụng `apps/frontend/src/test/api.test.ts` gồm 10 tests bao quát toàn bộ negative cases (payload phẳng, missing data, missing timestamp, success=false trên HTTP 200, invalid JSON text, HTTP 403 error envelope, 400 validation error details, HTTP 502 HTML error).
  2. **Đồng bộ Error Envelope (Backend - OpenAPI - Guide):**
     - Cập nhật `apps/backend/src/common/interfaces/api-response.interface.ts` và `apps/backend/src/common/filters/http-exception.filter.ts`: Đối tượng `error` trong phản hồi HTTP lỗi luôn có `{ code: string, message: string, details?: ApiErrorDetail[] }`, tương thích 100% với schema `error` trong OpenAPI `ErrorEnvelope`.
     - Bổ sung unit test `apps/backend/src/common/filters/http-exception.filter.spec.ts` kiểm thử 4 kịch bản lỗi (NotFound, BadRequest validation, Forbidden, generic Error).
     - Cập nhật `docs/api/integration_guide.md` mục 1.2 và bổ sung mục 1.3 "Báo cáo Đồng bộ Hóa & Contract Mismatch Analysis với OpenAPI v1.2", giải trình chi tiết về kiến trúc envelope mở rộng bảo đảm đối xứng.
  3. **Khắc phục Điểm Uy tín & Ngưỡng Khóa Tài khoản (`state_machines.md`):**
     - Loại bỏ hoàn toàn các giả định sai lệch về khởi tạo 100 điểm, trừ -5 điểm và ngưỡng khóa $\le 20$.
     - Khôi phục chính xác theo Hồ sơ nghiệp vụ v1.2 và SQL baseline: Thang điểm `0.0 <= reputation_score <= 5.0`, mặc định `5.0`. Trừ đúng `-0.1` điểm khi người bán không phản hồi báo cáo (`NO_RESPONSE`) đạt ngưỡng chu kỳ $K$ ($K=3..5$, mặc định $K=3$), chặn dưới tại `0.0`, chống trừ trùng bằng `report_cycle_key`.
     - Khẳng định trạng thái `SUSPENDED` là quyết định hành chính có chủ đích của Quản trị viên (`ADMIN`), được ghi nhận vào `audit_logs` (BR-18), không tự động kích hoạt theo ngưỡng điểm.
  4. **Chuẩn hóa Endpoint Method & Path với OpenAPI:**
     - Xây dựng script kiểm toán tự động `scripts/audit_endpoints.py` đối chiếu toàn bộ endpoint trong `authorization_matrix.md`, `integration_guide.md` và `state_machines.md` với 49 operations của `packages/api-contract/openapi.yaml`.
     - Thay thế toàn bộ endpoint nội bộ bằng canonical OpenAPI path (ví dụ: `POST /me/evidence`, `GET /me/verification`, `POST /posts/{id}/activate`, `POST /reports/{reportId}/seller-response`, `PATCH /admin/users/{userId}/status`).
     - Đánh dấu rõ ràng các endpoint chưa có trong contract v1.2 (`[Chưa có trong OpenAPI v1.2 / Đề xuất mở rộng]` như `/auth/logout`, `/users/{id}`, `/auth/refresh`).
  5. **Thắt chặt An toàn TLS cho Remote PostgreSQL:**
     - Sửa `apps/backend/src/config/database.config.ts`: Đối với kết nối remote / Supabase, bắt buộc `rejectUnauthorized: true`, hoàn toàn không cho phép biến môi trường `PGSSL_REJECT_UNAUTHORIZED=false` tắt kiểm tra chứng chỉ trên remote DB.
     - Xác minh chứng chỉ gốc `database/supabase-ca.crt` (Supabase Root CA 2021) và kiểm thử nạp tự động thành công.
     - Cập nhật unit test `apps/backend/src/config/database.config.spec.ts` chứng minh kết nối Supabase luôn từ chối chứng chỉ không hợp lệ.
  6. **Cập nhật GitHub Actions CI Workflow:**
     - Sửa `.github/workflows/ci.yml`: Bổ sung bước chạy Backend E2E (`pnpm test:e2e`).
     - Phân định rõ ràng trong workflow giữa kiểm thử tự động trên CI (mocked / isolated) và kiểm thử cơ sở dữ liệu thật (`pnpm db:test`) vốn chỉ chạy thủ công trên môi trường được cấp quyền.

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
