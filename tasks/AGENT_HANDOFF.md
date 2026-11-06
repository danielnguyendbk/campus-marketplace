# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Foundation Audit & System Architecture Documentation (PR #1 - Sẵn sàng Merge)
- **Cập nhật lần cuối:** 2026-11-06 09:30
- **Người bàn giao:** Senior Backend Architect & Technical Project Manager
- **Người tiếp nhận:** Backend Lead / Tech Lead / Reviewer
- **Branch hiện tại:** `fix/be-foundation-audit` (PR #1 nhắm vào `develop`, không tạo PR mới, không merge)
- **Tình trạng Database:** Kết nối an toàn qua TLS Certificate Verification (`rejectUnauthorized: true` bắt buộc tuyệt đối cho remote/Supabase DB), xác nhận đủ 18/18 bảng baseline v1.2 trên Supabase PostgreSQL 17 Pooler.
- **Tình trạng Kiến trúc & Công nghệ:** Xác nhận đối chiếu bảng thay đổi công nghệ theo `ARCHITECTURE.md`:
  - Frontend: Ban đầu chốt **Next.js** $\to$ Technical Architecture hiện tại: **React 18 + Vite 5**.
  - Database Access: Ban đầu chốt **Prisma** $\to$ Technical Architecture hiện tại: **SQL-first với `node-postgres (pg)`**.
  - Database: Ban đầu chốt **PostgreSQL** $\to$ Technical Architecture hiện tại: **PostgreSQL trên Supabase**.
  - Backend: **NestJS** (giữ nguyên).
  - _Hai thay đổi đầu tiên là đáng chú ý và đã được tài liệu hóa chi tiết tại Mục 1.3 của `ARCHITECTURE.md`._
- **Tình trạng kiểm thử:** PASS 100% (Backend Unit Tests 31/31, Backend E2E 38/38, Frontend Vitest 19/19, Lint 0 warnings, Typecheck 0 errors, Build thành công).
- **Trạng thái phê duyệt:** `READY_TO_MERGE` (Đã hoàn tất toàn bộ code, tests, CI, tài liệu kiến trúc kỹ thuật toàn diện `docs/ARCHITECTURE.md` và kế hoạch phân rã 4 Sprint 20 Task `tasks/BACKLOG.md`).

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #008: Đồng bộ Backlog 4 Sprint 20 Task Backend & Xác thực Frontend Stack

- **Ngày:** 2026-11-06
- **Người thực hiện:** Senior Backend Architect & Technical Project Manager
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Đồng bộ Kế hoạch Phân rã Công việc Backend 2 Người vào Backlog (`tasks/BACKLOG.md`):**
     - Thiết kế lộ trình 4 Sprints (8 tuần) với 20 nhiệm vụ kỹ thuật độc lập:
       - **BE-01 (Backend Tech Lead):** `BE-01-T01` (Email OTP), `BE-01-T02` (Register & Login JWT), `BE-01-T03` (Guards & RBAC), `BE-01-T04` (Profile & Preferences), `BE-01-T05` (Phone Reveal Privacy), `BE-01-T06` (Conversations CRUD), `BE-01-T07` (Messages & Attachments), `BE-01-T08` (Socket.IO Gateway & Handshake Auth), `BE-01-T09` (Realtime Event Stream Broadcaster), `BE-01-T10` (Rate Limiting, Log Sanitizer, File Cleanup).
       - **BE-02 (Backend Developer):** `BE-02-T01` (Evidence Submit), `BE-02-T02` (Admin Verify Approval), `BE-02-T03` (Categories & Seed), `BE-02-T04` (Post CRUD SELL/BUY), `BE-02-T05` (Post Lifecycle State), `BE-02-T06` (Post Images R2), `BE-02-T07` (Tiered Feed & Matching), `BE-02-T08` (Report 6-State Engine), `BE-02-T09` (Reputation Event Engine K=3), `BE-02-T10` (Admin Governance, Audit Logs & System Configs).
     - Thiết lập Shared Kernel (Giao diện chốt trước trong Sprint 1: `AuthenticatedUser`, Stub Guards, `IStorageService`, `IRealtimeService`) giúp 2 kỹ sư triển khai song song 100% không bị chặn (non-blocking).
     - Quy chuẩn hóa Gitflow, PR Protocol (Tech Lead review chính), tiêu chuẩn DoD và GitHub Labels.
  2. **Xác thực Kiến trúc Frontend Stack:**
     - Kiểm chứng trực tiếp codebase `apps/frontend/package.json`: Ứng dụng client là **React 18 + Vite (SPA)**, Client-side routing với `react-router-dom`, unit testing với `vitest` và `@testing-library/react`. **Không phải Next.js**.
     - Làm rõ mối quan hệ giữa form phác thảo kiến trúc tham khảo và codebase thực tế trong monorepo.
  3. **Chuẩn hóa Định dạng Tài liệu Kiến trúc (`docs/ARCHITECTURE.md`):**
     - Đảm bảo tài liệu kiến trúc 9 phần đã đồng bộ hoàn chỉnh và tuân thủ các quy tắc format của repo.
- **Kết quả kiểm thử thực tế:**
  - `pnpm lint`: **PASS** (0 warnings).
  - `pnpm typecheck`: **PASS** (0 errors).
  - `pnpm --filter @campus/backend test`: **PASS** (31/31 tests).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (38/38 tests).
  - `pnpm --filter @campus/frontend test`: **PASS** (19/19 tests).
  - `pnpm build`: **PASS** (Toàn bộ workspace build thành công).

### Handoff #007: Khởi tạo Tài liệu Kiến trúc Hệ thống Toàn diện (ARCHITECTURE.md)

- **Ngày:** 2026-11-04
- **Người thực hiện:** Senior Backend Engineer & System Architect
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Khởi tạo Tài liệu Kiến trúc Chuẩn hóa (`docs/ARCHITECTURE.md` & `ARCHITECTURE.md`):**
     - Xây dựng tài liệu kiến trúc toàn diện gồm 9 phần đúng theo form yêu cầu:
       1. Overview: Bối cảnh, mục tiêu và bảng công nghệ cốt lõi (`pnpm`, React 18/Vite, NestJS 10, Node-postgres SQL-first, Supabase PostgreSQL v1.2, Cloudflare R2, Socket.IO, OpenAPI v1.2).
       2. System Architecture: Sơ đồ kiến trúc 4 tầng chi tiết (Client, Application/Gateway, Storage & Realtime, Data Persistence) bằng Mermaid flowchart.
       3. Monorepo Structure: Cấu trúc thư mục chi tiết, phân định quyền sở hữu (Code Ownership).
       4. Backend Architecture: Mô hình Modular Monolith 3 tầng, phân rã 7 Domain Modules và Common Kernel.
       5. Database Design: 18 bảng CSDL PostgreSQL v1.2 kèm sơ đồ ERD trực quan (Mermaid).
       6. API Design: Chuẩn RESTful `/api/v1`, Success Envelope `{ success, data, [meta], timestamp }`, Error Envelope chuẩn OpenAPI v1.2, Sequence Diagram luồng đăng ký & xác thực OTP email trường.
       7. Realtime & Storage: Kiến trúc Cloudflare R2 (Private Bucket cho thẻ SV/chat tệp đính kèm với Presigned URLs; Public CDN Bucket cho bài đăng), Socket.IO Realtime Gateway (`/ws`) handshake Bearer token an toàn.
       8. Security: Quy chuẩn bảo mật thẻ sinh viên (BR-03: chỉ Admin xem ảnh thẻ qua Signed URL, ẩn trên UI), ẩn số điện thoại (BR-07/08), ma trận RBAC, TLS enforcement cho remote DB và HTTP 500 safe guard.
       9. Development Convention: Gitflow workflow (GitGraph), quy ước đặt tên (Naming Conventions) và Definition of Done (DoD).
  2. **Đồng bộ Liên kết Tài liệu:**
     - Cập nhật `README.md` và `docs/architecture/README.md` dẫn trực tiếp tới `docs/ARCHITECTURE.md`.
- **Kết quả kiểm thử thực tế:**
  - `pnpm lint`: **PASS** (0 warnings across workspace).
  - `pnpm typecheck`: **PASS** (0 errors across workspace).
  - `pnpm --filter @campus/backend test`: **PASS** (5/5 suites, 31/31 tests).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (3/3 suites, 38/38 tests).
  - `pnpm --filter @campus/frontend test`: **PASS** (2/2 suites, 19/19 tests).
  - `pnpm build`: **PASS** (Toàn bộ workspace build thành công).

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #006: Chuẩn hóa Success Envelope Toàn diện (OpenAPI Contract Phương án 1 & Root-level Pagination)

- **Ngày:** 2026-11-03
- **Người thực hiện:** Senior Backend Engineer & API Contract Reviewer
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Chuẩn hóa Success Envelope trong OpenAPI Contract (`packages/api-contract/openapi.yaml`):**
     - Cập nhật 15 Single-entity Response schemas: Thêm `success: { type: boolean, example: true }`, `timestamp: { type: string, format: date-time }`, yêu cầu `required: [success, data, timestamp]` và `additionalProperties: false`.
     - Cập nhật 11 Paginated Page schemas (`CategoryPage`, `PostPage`, `PendingFeedPage`, `ConversationPage`, `MessagePage`, `ReportPage`, `AdminUserPage`, `AuditLogPage`, `ReputationEventPage`, `NotificationPage`, `SystemConfigPage`): Giữ `data` (mảng) và `meta` (`PageMeta`) ở root level, bổ sung `success` và `timestamp`, yêu cầu `required: [success, data, meta, timestamp]` và `additionalProperties: false`. Tuyệt đối không lồng `data: { data, meta }`.
     - Cập nhật schema phân trang inline của `GET /admin/verifications` và bổ sung `AdminUserResponse` cho `PATCH /admin/users/{userId}/status`.
     - Đồng bộ toàn bộ 20 response examples trong `openapi.yaml` chứa đầy đủ `success: true` và `timestamp`. Prettier format hoàn hảo.
  2. **Nâng cấp Backend Interceptor & TypeScript Interfaces:**
     - `apps/backend/src/common/interfaces/api-response.interface.ts`: Định nghĩa `PageMeta`, `ApiResponse<T>`, `PaginatedResponse<T>`, `PaginatedResult<T>`.
     - `apps/backend/src/common/interceptors/transform.interceptor.ts`: Tự động nhận diện dữ liệu phân trang (`data` là mảng và có `meta` hợp lệ) để bọc thành `{ success: true, data, meta, timestamp }` ở root; các phản hồi thông thường được bọc `{ success: true, data, timestamp }`.
     - Viết bộ unit test `apps/backend/src/common/interceptors/transform.interceptor.spec.ts` kiểm thử đầy đủ single entity, paginated payload, null, primitive, edge cases và bảo đảm không có trường thừa.
  3. **Đồng bộ Frontend `ApiClient` & Vitest Suites:**
     - `apps/frontend/src/services/api.ts`: Thêm `PageMeta`, `ApiPaginatedEnvelope<T>`, `PaginatedResult<T>`, và phương thức `requestPaginated<T>()`.
     - Bổ sung kiểm thử nghiêm ngặt trong `apps/frontend/src/test/api.test.ts` kiểm chứng bóc tách phân trang và từ chối các phản hồi phân trang sai envelope.
  4. **Tài liệu hóa Tích hợp (`docs/api/integration_guide.md`):**
     - Cập nhật mục 1.1 và mục 3 tài liệu hóa kiến trúc envelope đơn và phân trang root-level chuẩn OpenAPI v1.2.
  5. **Bộ Kiểm thử Contract Tự động E2E (`contract-schemas.e2e-spec.ts`):**
     - Kiểm tra tĩnh toàn bộ các schemas trong `openapi.yaml` bảo đảm có đủ `success`, `timestamp`, `additionalProperties: false`.
     - Kiểm tra runtime qua HTTP Supertest xác nhận phản hồi thực tế tuân thủ 100% contract và không có trường thừa (`Object.keys` strictly match).
- **Kết quả kiểm thử thực tế:**
  - `pnpm --filter @campus/backend test`: **PASS** (5 suites, 31/31 tests passed).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (3 suites, 38/38 tests passed).
  - `pnpm --filter @campus/frontend test`: **PASS** (2 suites, 19/19 tests passed).
  - `pnpm lint`: **PASS** (0 warnings across workspace).
  - `pnpm typecheck`: **PASS** (0 errors across workspace).
  - `pnpm build`: **PASS** (Toàn bộ apps và packages build thành công).

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #005: Khắc phục Triệt để Schema ErrorEnvelope (additionalProperties: false) & An toàn Lỗi 500

- **Ngày:** 2026-11-03
- **Người thực hiện:** Senior Backend Engineer & API Contract Reviewer
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Đối chiếu và Chuẩn hóa Error Envelope theo OpenAPI v1.2:**
     - Loại bỏ toàn bộ các trường dư thừa ở top-level (`success`, `statusCode`, `timestamp`, `path`, root `message`) vốn vi phạm ràng buộc `additionalProperties: false` của schema `ErrorEnvelope`.
     - Phản hồi lỗi chỉ chứa duy nhất `error: { code, message, details? }` và `requestId` (tùy chọn). Mã HTTP status được trả qua HTTP header chuẩn.
     - Cập nhật `apps/backend/src/common/interfaces/api-response.interface.ts` và `apps/backend/src/common/filters/http-exception.filter.ts`.
     - Bổ sung bộ contract tests E2E chuyên sâu `apps/backend/test/error-envelope.e2e-spec.ts` kiểm chứng trực tiếp tính tương thích với OpenAPI `ErrorEnvelope`.
  2. **Bảo mật Tối đa Toàn bộ Lỗi HTTP 500 (Security Directives):**
     - Sửa `AllExceptionsFilter`: TẤT CẢ lỗi có status 500 (bao gồm cả `InternalServerErrorException`, `HttpException` có status 500, lỗi PostgreSQL, lỗi crash runtime, `TypeError`) đều bắt buộc trả về HTTP 500 với thông điệp công khai an toàn: `code: "INTERNAL_SERVER_ERROR"`, `message: "Internal server error"`, không trả `details`.
     - Không trả stack trace, database credentials, SQL query hoặc thông tin nội bộ trong response.
     - Tích hợp hàm `sanitizeLogMessage` tự động lọc và làm sạch (redact) mật khẩu, chuỗi kết nối database (`postgresql://...`), bearer tokens và secrets trước khi ghi vào server logs.
     - Bổ sung regression tests trong `apps/backend/src/common/filters/http-exception.filter.spec.ts` và `apps/backend/test/error-envelope.e2e-spec.ts` mô phỏng:
       - `InternalServerErrorException` chứa câu lệnh SQL và mật khẩu.
       - Lỗi kết nối PostgreSQL chứa URL và mật khẩu database.
       - Lỗi runtime `TypeError` chứa tên biến nhạy cảm và stack trace.
  3. **Đối chiếu Success Envelope & Đề xuất Chuẩn hóa OpenAPI:**
     - Thực hiện audit toàn bộ 48 operations 2xx trong OpenAPI v1.2.
     - Phát hiện 26 schema response mang thuộc tính `{ data }` và `additionalProperties: false` nhưng thiếu `{ success, timestamp }`.
     - Phân tích ảnh hưởng toàn diện (Frontend, Backend, Apidog Mock).
     - Lập Contract Change Proposal riêng, đánh dấu `BLOCKED_PENDING_APPROVAL` chờ Backend Lead phê duyệt.
- **Kết quả kiểm thử thực tế:**
  - `pnpm --filter @campus/backend test`: **PASS** (4 suites, 24/24 tests passed).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (2 suites, 7/7 tests passed).
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
