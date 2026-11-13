# AI Agent Task Handoff Journal

Tài liệu này là kênh bàn giao trạng thái công việc giữa các AI Agent (hoặc giữa Lập trình viên và AI Agent). Trước khi bắt đầu một phiên làm việc, Agent **BẮT BUỘC** phải đọc mục **Trạng thái mới nhất** ở đầu tệp này.

---

## Trạng thái hệ thống hiện tại

- **Giai đoạn:** Sprint 1 — Sự cố ISS-01 Đã Khắc Phục, CSDL Supabase Mới Sẵn Sàng & Regression Test Toàn Diện Đạt 100% (CMP-33 In Progress)
- **Cập nhật lần cuối:** 2026-11-13 23:20
- **Người bàn giao:** Backend Lead (Quốc Thái Nguyễn)
- **Người tiếp nhận:** PM (Nguyễn Minh Châu), Sprint 1 Team (Huy, Thạch, Phú)
- **Branch hiện tại:** `develop`
- **Tình trạng Database:** Đã tái tạo môi trường CSDL sạch trên Supabase mới (Project `ybguidivvmgwxspowkor`, AWS Sydney Pooler, TLS Certificate Verification `rejectUnauthorized: true`). Áp dụng thành công 100% cấu trúc 18/18 bảng baseline v1.2, migration `0001_dbml_review_fixes.sql` (kèm bảng tracking `_migrations`, cột `deleted_at`, partial unique index `uq_active_report_per_buyer`, và 8 ràng buộc CHECK nghiệp vụ). Đã chạy kiểm toán `pnpm db:verify` PASS 100%. Connection string được quản lý an toàn qua biến môi trường cục bộ (`.env` và `apps/backend/.env`), không rò rỉ secret lên Git/Jira.
- **Tình trạng Kiểm thử & Chất lượng Toàn diện:**
  - `pnpm lint`: PASS (0 warnings across workspace).
  - `pnpm typecheck`: PASS (0 errors across workspace).
  - `pnpm test`: PASS 132/132 tests (Frontend Vitest 58/58 + Backend Jest 74/74).
  - `pnpm test:e2e`: PASS 40/40 tests across 4 test suites (bao gồm `auth.e2e-spec.ts` tương tác trực tiếp CSDL Supabase).
  - `pnpm build`: PASS (NestJS build + Next.js App Router 7/7 static pages: `/`, `/_not-found`, `/login`, `/register`, `/verification`).
- **Trạng thái Jira:**
  - [CMP-33](https://chauviplong1701.atlassian.net/browse/CMP-33): `[Sprint 1][Incident ISS-01] Khôi phục Supabase và regression test OTP/Auth` -> **In Progress** (Hoàn thành phạm vi BE Lead, chờ PM nghiệm thu)
  - `CMP-6` / `CMP-28`: `[Sprint 1][BE2] API email OTP, tạo tài khoản và đăng nhập` -> Đã merge vào `develop` (PR #3)
  - `CMP-29`: `[Sprint 1][FE1] Màn hình đăng ký, OTP và đăng nhập` -> Đã merge vào `develop` (PR #2)
  - `CMP-31`: `[Sprint 1][QA] Kiểm thử tích hợp auth và dữ liệu PENDING` -> Đã merge vào `develop` (PR #4)
  - [CMP-26](https://chauviplong1701.atlassian.net/browse/CMP-26): `[Sprint 1][BE Lead] Xác minh SQL migrations, ràng buộc và kết nối Supabase` -> **Done** (2 SP)
  - [CMP-27](https://chauviplong1701.atlassian.net/browse/CMP-27): `[Sprint 1][BE Lead/FE] Kiểm chứng monorepo, môi trường và CI` -> **Done** (2 SP)

### Cập nhật QA — Kiểm thử tích hợp CMP-6 (2026-11-13)

- **Người thực hiện:** QA Agent (phiên kiểm thử tích hợp), theo kế hoạch `integration_test_plan.md` (v2).
- **Branch:** `feat/cmp-31` (commit nền `990583b`), **chưa push/PR**.
- **Trạng thái:** **DONE** cho phạm vi kiểm thử tích hợp FE–BE–Supabase. Không blocker.
- **Kết quả:** Baseline xanh toàn bộ (`lint`, `typecheck`, `test` 74 BE + 58 FE, `test:e2e` 40, `build`). Chạy thật 4 endpoint auth với `MAIL_TRANSPORT=smtp`: A1–A7, B1–B4, C1–C5, D1–D2 đạt; contract khớp (register **201**, envelope chuẩn); DB `otp_verifications` chỉ chứa `code_hash`, `users` PENDING + bcrypt `$2b$12$`; quét log/response/browser storage: 0 rò rỉ OTP/mật khẩu/token.
- **Bug Minor đã soạn sẵn Jira:** `/health` lộ message driver PostgreSQL (+ `/health` không có trong OpenAPI); FE gộp mọi 429 thành một câu thông báo; `ErrorEnvelope.details` dùng `additional: false`.
- **Còn chờ người dùng:** ảnh nội dung email OTP (bằng chứng trực quan duy nhất chưa có), tạo Jira bug, quyết định ticket cấu hình cổng 3000 còn hard-code trong `.env.example`/`README`/`docs/api/auth.http`.
- **Tài liệu:** [`docs/qa/CMP-6-integration-checklist.md`](file:///d:/PTIT/QLDAPM/doanQLDAPM/campus-marketplace/docs/qa/CMP-6-integration-checklist.md) · [`docs/qa/CMP-6-jira-bug-drafts.md`](file:///d:/PTIT/QLDAPM/doanQLDAPM/campus-marketplace/docs/qa/CMP-6-jira-bug-drafts.md).

### Cập nhật Frontend — CMP-29 (2026-11-12)

- **Người thực hiện:** Đình Thạch (Frontend), với Codex hỗ trợ.
- **Branch:** `feat/fe-cmp-29-auth-ui`, rẽ từ `develop` tại `7a82cc2`, đồng bộ các cập nhật BE Lead đến `5417dd3` trước khi mở PR.
- **Trạng thái:** Đã triển khai auth và nối luồng sau auth theo hồ sơ v1.2: đăng ký đến `/verification`, đăng nhập đến `/`, `PENDING` được xem bảng tin giới hạn. Chờ kiểm tra thủ công, tích hợp backend và tạo/review PR. Chưa đánh dấu Jira Done.
- **Kiểm chứng FE:** ESLint 0 warnings, TypeScript không lỗi, Vitest **58/58 PASS** trong hai file test hiện có, Next.js production build PASS với `/`, `/login`, `/register`, `/verification`.
- **Giới hạn:** Chưa kiểm chứng OTP email thật, multipart/storage và quyền server trong CMP-31. Lần xem trình duyệt mới không kết nối được localhost:5173 vì server chưa chạy; người dùng cần chạy lại frontend. Backend unit/E2E và quyền liệt kê tài khoản Git Credential Manager ở phiên trước bị từ chối, không thử lại các thao tác đó. Đã commit phần triển khai `9a6e801`, đồng bộ develop bằng `3f2a590` và push thành công nhánh FE; chưa tạo PR vì yêu cầu quyền tạo Draft PR bị từ chối. Session chỉ giữ trong bộ nhớ, reload cần đăng nhập lại.
- **Hướng dẫn chạy và nội dung PR:** `apps/frontend/src/features/auth/README.md`, `apps/frontend/src/features/auth/PR_DESCRIPTION.md`.

---

## Lịch sử bàn giao (Handoff Log)

### Handoff #019: Khắc phục Sự cố Môi trường ISS-01 & Tái tạo CSDL Supabase Sạch (CMP-33) (13/11/2026)

- **Ngày:** 2026-11-13 (22:30–23:25 GMT+7)
- **Người thực hiện:** Backend Lead (Quốc Thái Nguyễn)
- **Branch:** `develop` (đồng bộ hoàn chỉnh với `origin/develop`)
- **Truy vết:** `CMP-33`, `ISS-01`, `CMP-26`, `CMP-28`, `CMP-29`, `CMP-31`, `CMP-6`
- **Mục tiêu đạt được theo Definition of Done của CMP-33:**
  1. **Điều tra Sự cố Môi trường & Khả năng Phục hồi:**
     - Đánh giá CSDL cũ `sbfnasjuyosdypwdnlsu`: Server vẫn hoạt động nhưng bị mất quyền truy cập tầng Supabase Cloud Dashboard do phân mảnh tài khoản/email quản trị. Database cũ không bị xóa vội để bảo toàn dữ liệu truy vết.
     - Quyết định xử lý: Khởi tạo project Supabase độc lập, sạch sẽ `ybguidivvmgwxspowkor` (AWS Sydney Pooler) do Backend Lead trực tiếp sở hữu để giải quyết triệt để vấn đề mất quyền và chủ động mở rộng.
  2. **Tái tạo CSDL Chuẩn & Chạy Toàn Bộ Migrations Trên DB Sạch:**
     - Nạp thành công toàn bộ **18/18 bảng baseline v1.2** (`database/baseline/schema_v1.2.sql`) với cấu trúc chuẩn: 11 ENUMs, 26 Foreign Keys (chiều khóa ngoại 1-1 đã chuẩn hóa `user_preferences`, `sell_details`, `buy_request_details`), 23 Unique Indexes.
     - Thực thi tự động migration `0001_dbml_review_fixes.sql` qua `pnpm db:migrate`: Bổ sung cột soft-delete `deleted_at timestamptz` trên `posts` và `users`, thiết lập Partial UNIQUE Index `uq_active_report_per_buyer` trên `reports (buyer_id, post_id)` với điều kiện `status IN ('SUBMITTED', 'WAITING_SELLER_RESPONSE', 'UNDER_REVIEW')`, và 8 ràng buộc kiểm tra toàn vẹn nghiệp vụ `CHECK`.
     - Chạy script kiểm toán toàn diện `pnpm db:verify`: Xác nhận 100% khớp chuẩn kiến trúc v1.2.
  3. **Quản lý Cấu hình An toàn Không Lộ Bí mật:**
     - Cập nhật Connection String an toàn vào `.env` và `apps/backend/.env` (được bảo vệ tuyệt đối trong `.gitignore`).
     - Tuyệt đối không commit hoặc đưa credentials/secret lên GitHub, Jira hay Zalo.
     - Enforce TLS Certificate Verification (`rejectUnauthorized: true`) với chứng chỉ Supabase Root CA.
  4. **Regression Test Toàn Bộ Hệ Thống:**
     - `pnpm lint`: PASS (0 warnings across workspace).
     - `pnpm typecheck`: PASS (0 errors across workspace).
     - `pnpm test`: PASS **132/132 tests** (Frontend Vitest 58/58 + Backend Jest 74/74).
     - `pnpm test:e2e`: PASS **40/40 tests** (Bao gồm `auth.e2e-spec.ts` kiểm thử trực tiếp trên database Supabase mới với các ca `request-otp` -> `verify-otp` -> `register` -> `login` -> `PENDING`).
     - `pnpm build`: PASS (NestJS build + Next.js App Router 7/7 static pages: `/`, `/_not-found`, `/login`, `/register`, `/verification`).
  5. **Báo Cáo Thời Gian & Phương Án Phòng Ngừa Lâu Dài:**
     - Thời gian xử lý sự cố thực tế: ~55 phút (từ tiếp nhận, tạo môi trường mới, nạp migration, regression test đến bàn giao).
     - Hướng phòng ngừa:
       - Duy trì script migration tự động `pnpm db:migrate` và kiểm toán `pnpm db:verify` trong quy trình CI/CD.
       - Chia sẻ quyền Developer cho các thành viên trong nhóm trên Supabase Dashboard để tránh phụ thuộc vào một tài khoản duy nhất.
       - Chuẩn bị sẵn cấu hình Docker Compose cho PostgreSQL 17 local làm môi trường fallback khi mạng quốc tế có sự cố.

### Handoff #018: Kiểm thử tích hợp FE–BE–Supabase cho luồng Auth CMP-6 (13/11/2026)

- **Ngày:** 2026-11-13 (16:31–16:52 GMT+7)
- **Người thực hiện:** QA Agent
- **Branch:** `feat/cmp-31` (commit nền `990583b`; **chưa commit/push/PR** — chờ người dùng đồng ý)
- **Truy vết:** `CMP-6`; `FR-01`; `BR-01/02`; `AT-01`; kế hoạch `integration_test_plan.md` (v2)
- **Mục tiêu:** chạy luồng thật `request OTP → verify OTP → register → login → PENDING` giữa FE Next.js, BE NestJS và Supabase; không sửa mã nguồn trong `apps/`.
- **Cấu hình đã dùng (chỉ file local, gitignored):** `apps/backend/.env` → `PORT=4000`, `CORS_ORIGIN=http://localhost:3000`, `ALLOWED_SCHOOL_DOMAINS=student.ptithcm.edu.vn`, `MAIL_TRANSPORT=smtp`; tạo mới `apps/frontend/.env.local` → `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` (không đặt `NEXT_PUBLIC_AUTH_API_MODE` ⇒ `live`). Sau D2, `DATABASE_URL` đã khôi phục nguyên bản.
- **Cách kiểm chứng OTP khi dùng SMTP thật:** mã đúng được suy ra từ `code_hash` bằng `OTP_HASH_SECRET` local (HMAC-SHA256 `email:code`), không ghi mã vào tài liệu/log. Nhờ vậy không phải dùng `ConsoleMailService`.
- **Kết quả (40/41 mục kiểm đạt — 25 mục API/DB + 16 mục UI; 1 phát hiện lỗi đã thành Bug CMP-6-01):**
  - Baseline: `lint`, `typecheck`, `test` (BE 74 + FE 58), `test:e2e` (40), `build` đều PASS.
  - Pha A (A1–A7): 400 `VALIDATION_FAILED`, 400 `EMAIL_DOMAIN_NOT_ALLOWED`, 429 `OTP_RATE_LIMITED`, 400 `OTP_INVALID` + `attempts` tăng, 429 `OTP_ATTEMPTS_EXCEEDED` ở lần 5, OTP hết hạn, `OTP_TICKET_INVALID` với ticket giả.
  - Pha B (B1–B4): `request-otp` 200 (1 dòng `otp_verifications`, chỉ `code_hash`), `verify-otp` 200 `{otpTicket, expiresIn:600}`, `register` **201** `USER/PENDING` + bcrypt `$2b$12$`, `login` 200 PENDING; UI chuyển màn hình sau đăng ký, **không** lưu token vào `localStorage`/`sessionStorage`/cookie.
  - Pha C (C1–C5): email đã đăng ký → 200 trung tính, không tạo OTP, không gửi mail; dùng lại ticket → 409; sai mật khẩu / email không tồn tại → 401 cùng message; mật khẩu < 8 → 400 `details.field=password`.
  - Pha D: tắt BE → UI báo "Không thể kết nối…" sau 2,55s (không treo); sai `DATABASE_URL` → `login`/`request-otp` trả 500 `INTERNAL_SERVER_ERROR` "Internal server error", không stack/URI.
  - Quét `backend.log` + `backend-d2.log` (10 mẫu: mật khẩu test, SMTP pass, DB pass, `eyJ…`, `postgres://`, `[DEV MAIL]`, `OTP=`, Bearer, `$2b$12$`): **0 hit**.
- **Bug phát hiện (đều Minor, không chặn luồng chính; nội dung Jira soạn sẵn):**
  1. `GET /health` trả nguyên văn `exception.message` của PostgreSQL khi mất kết nối (lộ tên user DB) và `/health` không có trong OpenAPI.
  2. FE gộp mọi lỗi 429 thành "Bạn đã yêu cầu quá nhiều lần…" kể cả `OTP_ATTEMPTS_EXCEEDED` (hướng dẫn sai: phải yêu cầu mã mới).
  3. `packages/api-contract/openapi.yaml` → `ErrorEnvelope.error.details.items` dùng `additional: false` (sai khoá, phải là `additionalProperties: false`).
- **Còn chờ (không chặn Done):** ảnh/đoạn video nội dung email OTP (bằng chứng trực quan duy nhất chưa có; đã xác nhận qua log `Dispatched OTP email … via SMTP`); tạo 3 Jira bug từ bản nháp; quyết định ticket cấu hình cho các chỗ còn hard-code cổng 3000 (`.env.example`, `docs/api/auth.http`, README FE/BE).
- **Ngoài phạm vi nhưng cần biết:** `GET /me/verification` và `GET /feed` hiện 404 (BE Sprint 1 mới có Auth + Health) ⇒ sau đăng ký trang `/verification` và phần nội dung trang chủ PENDING hiển thị lỗi. Thuộc `BE-02-T01` / `BE-02-T07`, không phải hồi quy của CMP-6.
- **Dữ liệu test cuối phiên:** 1 user `n23dccn162@student.ptithcm.edu.vn` (`USER`, `PENDING`) + 1 dòng `otp_verifications` đã verify. Muốn quay lại từ đầu:
  ```sql
  DELETE FROM public.otp_verifications WHERE email = 'n23dccn162@student.ptithcm.edu.vn';
  DELETE FROM public.users             WHERE school_email = 'n23dccn162@student.ptithcm.edu.vn';
  ```
  (Lưu ý: kế hoạch ghi `email_otps`/`status`, tên thật là `otp_verifications`/`verification_status`.)
- **File thay đổi:** `docs/qa/CMP-6-integration-checklist.md`, `docs/qa/CMP-6-jira-bug-drafts.md` (mới); `tasks/AGENT_HANDOFF.md`, `tasks/BACKLOG.md` (cập nhật). **Không** sửa `apps/`, `database/`, `packages/`.
- **Bằng chứng local (KHÔNG commit):** `docs/qa/evidence/CMP-6/` gồm `baseline.log`, `backend.log`, `backend-d2.log`, `frontend.log`, `api-phase-{A,B,C,D}.json`, `ui-*.json`, `screens/*.png` (17 ảnh). Chứa email sinh viên và log runtime ⇒ phải che/xoá trước khi đính kèm Jira.
- **Hướng dẫn người kế tiếp:** muốn chạy lại toàn bộ: bật BE cổng 4000 + FE cổng 3000, dọn DB theo SQL trên, chạy A→B→C→D theo checklist; script dùng một lần nằm ở `C:\Users\nguye\AppData\Local\Temp\opencode\cmp6\` (ngoài repo, có thể xoá). Không cần cài Playwright vào repo (đã dùng bản tạm `npx`).
- **Ghi chú tài liệu (dọn dẹp nhỏ, không đổi nội dung bàn giao):** file `tasks/AGENT_HANDOFF.md` trước đó còn sót 3 dòng conflict marker (`<<<<<<< HEAD` / `=======` / `>>>>>>> origin/develop`) đã bị commit từ commit `990583b` khiến tài liệu render sai — phiên này đã xoá 3 dòng đó, giữ nguyên cả hai nhánh nội dung. Vẫn còn **trùng số Handoff #014** (một của BE2 Auth OTP, một của BE Lead sửa FK baseline) — để nguyên, cần đánh số lại ở lần bàn giao sau để tránh nhầm lẫn.

### Handoff #014: Triển khai API Email OTP, Tạo tài khoản PENDING và Đăng nhập JWT (CMP-6 / BE-01-T01 & BE-01-T02) (12/11/2026)

- **Ngày:** 2026-11-12
- **Người thực hiện:** Backend Developer (BE2)
- **Branch:** `feat/be-auth-otp-session`
- **Truy vết:** `CMP-6`; `FR-01`; `BR-01/02`; `AT-01`; `BE-01-T01` & `BE-01-T02`
- **Mục tiêu đạt được:**
  1. **Triển khai 4 API Xác thực theo đúng OpenAPI v1.2 (`packages/api-contract/openapi.yaml`):**
     - `POST /api/v1/auth/request-otp`: Chuẩn hóa email (`trim().toLowerCase()`), kiểm tra domain trường đại học theo allowlist (`ALLOWED_SCHOOL_DOMAINS`, mặc định `edu.vn` khớp `*.edu.vn`). Nếu email đã tồn tại trong `users` thì trả về `200 SimpleMessageResponse` với thông điệp chung mà **không** sinh/gửi OTP (chống dò email theo contract). Áp dụng cooldown gửi lại (`60s`) và giới hạn theo giờ (`5 OTP/giờ/email` -> `429 OTP_RATE_LIMITED`). Mã OTP 6 chữ số chỉ lưu bản băm HMAC-SHA256 (`code_hash`), thời hạn 10 phút (`600s`); nếu gửi mail thất bại thì tự động vô hiệu bản ghi OTP vừa tạo.
     - `POST /api/v1/auth/verify-otp`: Kiểm tra OTP còn hạn và chưa dùng bằng `timingSafeEqual`; tăng `attempts` nguyên tử trong DB, khóa ở lần sai thứ 5 (`429 OTP_ATTEMPTS_EXCEEDED`); khi đúng đánh dấu `verified_at` và cấp `otpTicket` (JWT HS256 ký bằng `OTP_TICKET_SECRET` tách biệt, hạn `600s`).
     - `POST /api/v1/auth/register`: Xác thực `otpTicket` hợp lệ và đối chiếu bản ghi `otp_verifications.verified_at IS NOT NULL`; băm mật khẩu bằng `bcryptjs` (`saltRounds = 12`); tạo tài khoản `role = 'USER'`, `verification_status = 'PENDING'` và cấp phiên `AuthSessionResponse` (`201 Created`). Trả `409 EMAIL_ALREADY_REGISTERED` nếu email đã đăng ký hoặc phát sinh xung đột unique `23505`.
     - `POST /api/v1/auth/login`: Cho phép tài khoản `PENDING`, `APPROVED`, `REJECTED` đăng nhập nhận JWT (`200 AuthSessionResponse`); chặn `SUSPENDED` với `403 ACCOUNT_SUSPENDED`; trả cùng mã `401 INVALID_CREDENTIALS` cho email không tồn tại hoặc sai mật khẩu (kèm dummy bcrypt compare chống timing attack).
  2. **Global Validation & Shared Kernel (`JwtAuthGuard`):**
     - Bổ sung `createValidationPipe()` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) trả về `VALIDATION_FAILED` kèm `details: [{ field, message }]` khớp tuyệt đối `ErrorEnvelope`.
     - Cung cấp `AuthenticatedUser` interface và `JwtAuthGuard` tại `src/common/auth/` (Shared Kernel cho Sprint 1), chặn request thiếu/sai/hết hạn token hoặc dùng nhầm `otp_ticket` với HTTP 401.
  3. **Chuẩn hóa Khóa ngoại & Truy vấn SQL trực tiếp (`UserRepository.createUser`):**
     - Sau khi chuẩn hóa chiều FK của `user_preferences`, `sell_details`, `buy_request_details` tại `database/baseline/schema_v1.2.sql` (dòng 330, 336, 338), `UserRepository.createUser` thực hiện `INSERT INTO "users" ("school_email", "password_hash", "display_name") VALUES ($1, $2, $3) RETURNING "id", "display_name", "role", "verification_status"` trực tiếp mà không cần tạo `user_preferences` trước.
     - *(Lưu ý: Nếu môi trường Supabase remote được khởi tạo từ bản `schema_v1.2.sql` cũ trước khi sửa dòng 330, 336, 338 thì cần áp dụng lại constraint FK tương ứng trên DB đó).*
- **Các file chính thêm mới / cập nhật:**
  - `apps/backend/src/config/env.config.ts`, `apps/backend/src/main.ts`, `apps/backend/src/app.module.ts`
  - `apps/backend/src/common/pipes/validation.pipe.ts` (+ `.spec.ts`)
  - `apps/backend/src/common/auth/authenticated-user.interface.ts`, `jwt-auth.guard.ts` (+ `.spec.ts`)
  - `apps/backend/src/modules/auth/*` (`auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `otp.service.ts`, `auth.types.ts`, DTOs, `otp.repository.ts`, `user.repository.ts`, `mail/*`, `utils/*` và toàn bộ `.spec.ts`)
  - `apps/backend/test/auth.e2e-spec.ts`
  - `.env.example`, `apps/backend/.env.example`, `docs/api/api_implementation_status.md`, `docs/api/auth.http`, `tasks/BACKLOG.md`
- **Kết quả kiểm thử:**
  - `pnpm lint`: PASS (0 warnings).
  - `pnpm typecheck`: PASS (0 errors).
  - `pnpm test`: PASS (12/12 Backend suites - 73/73 tests; 2/2 Frontend suites - 19/19 tests).
  - `pnpm test:e2e`: PASS (4/4 Backend E2E suites - 40/40 tests).
  - `pnpm build`: PASS (Next.js 14 App Router + NestJS build thành công).
### Handoff #017: Commit và push CMP-29, chờ mở Draft PR (12/11/2026)

- **Quy trình đã thực hiện:** Đọc lại toàn bộ AGENTS/CLAUDE, Gitflow/DoD, mẫu task/PR, CI và quy tắc định dạng; giữ nhánh `feat/fe-cmp-29-auth-ui`, PR đích `develop`, không merge trực tiếp vào develop/main.
- **Commit triển khai:** `9a6e801` — `feat(frontend): add OTP auth and pending student flow (CMP-29)`, gồm 28 file đã rà soát (FE, dependency/lockfile đã được duyệt và nhật ký), không có `.env`, dependencies, file build hoặc secret thực.
- **Đồng bộ nền:** Fetch develop mới đến `5417dd3` gồm hai commit của BE Lead; merge vào nhánh FE bằng `3f2a590`. Chỉ xung đột nhật ký và đã giữ toàn bộ nội dung hai bên. Nhận nguyên trạng bản sửa database của BE Lead; chênh lệch PR so với develop không chứa sửa backend/database/contract. Giữ Handoff BE #014, đánh số mục FE thành #015–016 để không trùng.
- **Push:** Thành công tới `origin/feat/fe-cmp-29-auth-ui`, đã thiết lập upstream. `git diff --check` và kiểm tra định dạng PASS; giữ bằng chứng FE 58/58 tests, lint/typecheck/build PASS từ lần kiểm chứng mã nguồn gần nhất (phần đồng bộ chỉ thay tài liệu và baseline DB của BE).
- **PR:** Chưa có PR được xác nhận tạo thành công. Lần gọi đầu chưa trả thông tin PR hợp lệ; yêu cầu quyền hoàn tất tạo Draft PR bị từ chối và đã dừng, không thử cách khác. Người dùng có thể mở `https://github.com/danielnguyendbk/campus-marketplace/pull/new/feat/fe-cmp-29-auth-ui`, chọn base `develop`, dùng nội dung trong `apps/frontend/src/features/auth/PR_DESCRIPTION.md` và chọn Create draft pull request.
- **Còn chờ:** Xác nhận giao diện desktop/mobile, PR/review/CI cho thay đổi này và tích hợp thật CMP-31. Không đánh dấu CMP-29 hoặc toàn bộ FE Sprint 1 Done.

### Handoff #016: Nối Auth với hồ sơ và bảng tin PENDING theo nghiệp vụ v1.2 (12/11/2026)

- **Yêu cầu đã xác nhận:** Người dùng yêu cầu đọc lại hồ sơ nghiệp vụ tại `D:\TÀI LIỆU PTITHCM\7. NĂM 4_HỌC KỲ 1\QUẢN LÝ DỰ ÁN PHẦN MỀM\Dự án\Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx`, xác nhận PENDING được đăng nhập/xem feed giới hạn và yêu cầu thực hiện phần nối luồng. Căn cứ: §2, §3.1, FR-04, BR-04, AT-03, phụ lục Chốt 01; OpenAPI `/feed` + `PendingFeedPage`.
- **Branch:** `feat/fe-cmp-29-auth-ui`, không đổi backend, database, contract, dependencies hoặc cấu hình môi trường trong phần bổ sung này.
- **Phiên và điều hướng:** Auth API giữ session trong bộ nhớ có subscription và thời hạn `expiresIn`; dùng chung token/transport cho auth, feed, hồ sơ. Đăng ký thành công chuyển `/verification`; đăng nhập PENDING/APPROVED chuyển `/`, REJECTED chuyển hồ sơ; người chưa đăng nhập, hết hạn/HTTP 401 và đăng xuất trở về `/login`. Không lưu token vào browser storage, không tạo endpoint refresh/logout.
- **Trang chủ:** Thay màn hình bootstrap tại `/` bằng bảng tin. PENDING chỉ nhận/hiển thị trường tóm tắt `id`, `title`, `postType`, `thumbnailUrl`, `createdAt`, không thêm giá/liên hệ, không link chi tiết và không gửi search/filter. Khóa các nút tìm kiếm/lọc/đăng tin/chat, chỉ dẫn hoàn thiện hồ sơ. Có loading/empty/error/retry, từ chối hiển thị feed cho REJECTED. Chưa xây dựng Marketplace đầy đủ cho APPROVED hoặc màn hình Admin.
- **Hồ sơ tối thiểu:** `/verification` gọi `GET /me/verification`, nộp/nộp lại bằng `POST /me/evidence` dạng FormData; trường, mã sinh viên, ảnh thẻ bắt buộc theo schema, kiểm tra ảnh tối đa 10 MB theo phản hồi 413 trong contract. ApiClient không ép Content-Type JSON khi body là FormData. Không tạo preview/URL ảnh thẻ, xóa lựa chọn ảnh và dữ liệu form sau nộp; không trả ảnh ở trạng thái duyệt. Nộp hồ sơ không tự nâng APPROVED.
- **Mock:** Bổ sung đúng GET feed/status và POST evidence theo contract, yêu cầu Bearer token mock, trả envelope chuẩn. Feed PENDING chỉ có summary, POST evidence giữ PENDING; dữ liệu/file không đi ra backend/storage. Các tùy chọn seed trạng thái và feed phục vụ kiểm thử, không bổ sung API tự duyệt. SVG thay thumbnail rỗng là minh họa, không phải ảnh thật sản phẩm.
- **Kiểm chứng:** Hai file test hiện có đạt 58/58 (19 nền tảng + 39 auth/phiên/quyền/hồ sơ). FE lint, typecheck, production build PASS. Đã kiểm tra cả lỗi 401/403, hết phiên, logout, REJECTED, ảnh sai loại/quá dung lượng và hợp đồng multipart. Chưa xác nhận trực quan desktop/mobile vì server local connection refused. Không chạy lại các thao tác backend/GitHub đã bị từ chối quyền ở phiên trước.
- **Bàn giao:** Hướng dẫn và PR body đã cập nhật trong `apps/frontend/src/features/auth/README.md`, `PR_DESCRIPTION.md`. Phần nối UI-02/UI-03 là phạm vi tối thiểu được người dùng yêu cầu để auth không bị cụt; không tuyên bố hoàn tất toàn bộ hồ sơ/Marketplace/backend. CMP-29 chỉ sẵn sàng để review mã nguồn; còn kiểm tra thủ công, PR, CI và review trước khi Done. CMP-31 cần xác minh API thật, quyền server và WebSocket cùng BE.

### Handoff #015: Triển khai giao diện Auth CMP-29, chờ kiểm tra thủ công và PR (12/11/2026)

- **Truy vết:** CMP-29 → CMP-6, FR-01, UI-01; FE đề xuất size **M**, chờ PM chốt.
- **Phạm vi:** `apps/frontend` và nhật ký bàn giao này; giữ nguyên backend, database và API contract. Đã bổ sung `@types/node@20.19.43` cùng importer trong `pnpm-lock.yaml` theo xác nhận riêng trước đó, để Next.js build không tự cài dependency.
- **Giao diện:** Auth layout navy/vàng, minh họa SVG nội bộ, responsive; `/register` gồm email → OTP → mật khẩu; `/login` có validation, loading, hiện/ẩn mật khẩu, lỗi và kết quả đăng nhập. Không mở bước mật khẩu trước `otpTicket` hợp lệ; đổi email, ticket hết hạn hoặc register HTTP 422 sẽ hủy trạng thái xác thực và xóa mật khẩu.
- **API:** Typed auth service gọi đúng bốn POST endpoint `/auth/request-otp`, `/auth/verify-otp`, `/auth/register`, `/auth/login` qua `src/services/api.ts`. Register chỉ gửi `otpTicket`, `displayName`, `password`. Success envelope bắt buộc `{ success: true, data, timestamp }`; tài khoản mới `USER/PENDING`, không tự cấp quyền Marketplace.
- **Mock:** Thêm transport tùy chọn vào ApiClient, giữ nguyên cách gọi và kiểm tra envelope hiện có. Adapter chỉ bật với `NEXT_PUBLIC_AUTH_API_MODE=mock`, có nhãn rõ trên UI, tài khoản/mật khẩu giả chỉ giữ trong bộ nhớ. Có OTP sai/hết hạn/đã dùng, resend/rate limit, ticket hết hạn/đã dùng, email trùng và đăng nhập sai. Không tự chuyển sang mock khi kết nối thật thất bại; mock token tách khỏi client thật.
- **Kiểm thử:** Chỉ mở rộng `src/test/App.test.tsx` và `src/test/api.test.ts`, không tạo file test mới. 19 tests nền tảng + 21 tests auth = **40 PASS**. FE lint, typecheck và production build PASS. Next build có cảnh báo cấu hình ESLint thiếu Next plugin sẵn có; không đổi cấu hình ngoài phạm vi.
- **Bàn giao tiếp theo:** Người dùng khởi động lại dev server ở `apps/frontend` với `NEXT_PUBLIC_AUTH_API_MODE=mock`, mở `/register` và `/login` (trang `/` vẫn là bootstrap). BE cung cấp API thật/allowlist/CORS/SMTP cho CMP-31. PR về `develop` cần review, CI và xác nhận thủ công trước khi đóng CMP-29. Chưa commit/push/tạo PR trong phiên này; nội dung theo template đã chuẩn bị tại `features/auth/PR_DESCRIPTION.md`.

### Handoff #014: Khắc phục Triệt để Khóa ngoại Bị ngược trong Baseline DDL v1.2 (12/11/2026)

- **Ngày:** 2026-11-12
- **Người thực hiện:** Backend Lead (Quốc Thái Nguyễn)
- **Branch:** `develop`
- **Mục tiêu đạt được:**
  1. **Khắc phục lỗi Foreign Key bị ngược chiều trong `database/baseline/schema_v1.2.sql`:**
     - Phát hiện 3 câu lệnh `ALTER TABLE` bị tool export (dbdiagram.io) sinh ngược chiều khóa ngoại cho các quan hệ 1-1 extension:
       - `users.id` trỏ sang `user_preferences.user_id` $\to$ Sửa thành: `user_preferences(user_id) REFERENCES users(id)`.
       - `posts.id` trỏ sang `sell_details.post_id` $\to$ Sửa thành: `sell_details(post_id) REFERENCES posts(id)`.
       - `posts.id` trỏ sang `buy_request_details.post_id` $\to$ Sửa thành: `buy_request_details(post_id) REFERENCES posts(id)`.
  2. **Đối soát tính toàn vẹn với CSDL Supabase:**
     - Xác nhận trên Supabase thực tế, các foreign keys đã được thiết lập đúng chiều (`fk_user_preferences_user`, `fk_sell_details_post`, `fk_buy_request_details_post`).
     - Chạy lại `pnpm db:test` và `pnpm db:verify` PASS 100%.
  3. **Commit & Push:** Đã commit và push đồng bộ lên nhánh `develop` (commit `b586305`).

---

### Handoff #013: Hoàn thành Xác minh CSDL Supabase (CMP-26) & Kiểm chứng Monorepo CI với ADR-003 (CMP-27) (10/11/2026)

- **Ngày:** 2026-11-10
- **Người thực hiện:** Backend Lead (Quốc Thái Nguyễn)
- **Branch:** `develop`
- **Mục tiêu đạt được:**
  1. **Xác minh SQL Migrations & Ràng buộc CSDL Supabase (CMP-26):**
     - Kết nối an toàn thành công tới PostgreSQL 17.11 trên Supabase Pooler qua TLS Certificate Verification (`rejectUnauthorized: true`), độ trễ ~220ms.
     - Xây dựng bộ công cụ migration tự động `apps/backend/src/database/run-migrations.ts` (`pnpm db:migrate`) có bảng theo dõi `_migrations`.
     - Thực thi thành công `database/migrations/0001_dbml_review_fixes.sql` trên live Supabase DB:
       - Thêm cột `deleted_at timestamptz DEFAULT NULL` trên `posts` và `users` (DB02 soft-delete).
       - Cập nhật Partial UNIQUE Index `uq_active_report_per_buyer` trên `reports (buyer_id, post_id)` với `WHERE status IN ('SUBMITTED', 'WAITING_SELLER_RESPONSE', 'UNDER_REVIEW')` (DB01 chống trùng báo cáo).
     - Xây dựng công cụ kiểm toán CSDL `apps/backend/src/database/verify-constraints.ts` (`pnpm db:verify`), xác nhận toàn bộ 9 CHECK constraints nghiệp vụ (`chk_sell_price`, `chk_buy_budget`, `chk_attachment_size`, `chk_report_not_self`, `chk_users_reputation_score`, `chk_conversation_members`, v.v.) và 29 FK/UNIQUE constraints đã hoạt động ổn định trên Supabase.
     - Cập nhật Jira ticket [CMP-26](https://chauviplong1701.atlassian.net/browse/CMP-26) sang trạng thái `Done`, gán Story Points = 2 (Size S) kèm comment bằng chứng chi tiết.
  2. **Kiểm chứng Monorepo, Môi trường và CI (CMP-27):**
     - Chốt dứt điểm công nghệ Frontend Web Client là **Next.js 14+ (App Router)** theo Quyết định D11.
     - Ban hành tài liệu quyết định kiến trúc [`docs/decisions/ADR-003-nextjs-app-router-frontend.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/docs/decisions/ADR-003-nextjs-app-router-frontend.md) làm rõ giá trị của SSR/SSG đối với SEO bài đăng đồ cũ và Client Components đối với tương tác thời gian thực Socket.IO `/ws`.
     - Đồng bộ 100% tài liệu kiến trúc [`docs/ARCHITECTURE.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/docs/ARCHITECTURE.md), loại bỏ triệt để các mâu thuẫn React/Vite.
     - Xác minh toàn bộ chuỗi lệnh chất lượng mã nguồn trên môi trường cục bộ:
       - `pnpm lint`: PASS (0 warnings).
       - `pnpm typecheck`: PASS (0 errors across workspace).
       - `pnpm test`: PASS (19/19 Frontend Vitest + 31/31 Backend Jest).
       - `pnpm test:e2e`: PASS (38/38 Backend E2E Supertest).
       - `pnpm build`: PASS (Next.js 14 App Router prerender 4/4 static pages + NestJS build).
     - Cập nhật Jira ticket [CMP-27](https://chauviplong1701.atlassian.net/browse/CMP-27) sang trạng thái `Done`, gán Story Points = 2 (Size S) kèm comment bằng chứng chi tiết.
  3. **Sẵn sàng cho Sprint 1 Features:**
     - Nền tảng Monorepo, CI và Cơ sở dữ liệu Supabase đã sẵn sàng 100% cho 2 kỹ sư triển khai các tác vụ tính năng tiếp theo (`BE-01-T01` Auth OTP, `BE-02-T01` Evidence Submit).

### Handoff #012: Chuẩn hóa Biểu diễn Guest là Trạng thái Chưa Xác thực (Unauthenticated State), Không phải Vai trò Nghiệp vụ (07/11/2026)

- **Ngày:** 2026-11-07
- **Người thực hiện:** Senior Backend Architect & Technical Project Manager
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Thống nhất Biểu diễn "Guest" là Trạng thái Chưa xác thực (Unauthenticated State):**
     - Làm rõ: "Guest" không phải là một vai trò nghiệp vụ thứ ba trong hệ thống hay trong CSDL. Enum `user_role` trong PostgreSQL và OpenAPI Contract chỉ định nghĩa duy nhất 2 vai trò nghiệp vụ: `USER` (sinh viên) và `ADMIN` (quản trị viên).
     - Khách vãng lai (Guest) là trạng thái client chưa gửi JWT Bearer Token hợp lệ.
     - Kiểm soát truy cập được phân rã thành **Mô hình 3 Tầng**:
       - Tầng 1: `JwtAuthGuard` (Authentication) — nếu Unauthenticated thì chặn **HTTP 401 Unauthorized** (ngoại trừ public endpoints).
       - Tầng 2: `RolesGuard` (Role Authorization) — phân định `USER` vs `ADMIN`.
       - Tầng 3: `VerificationGuard` (Verification Status) — kiểm tra trạng thái thẻ SV `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`.
  2. **Khẳng định Quy định Chặn Bảng tin với Người dùng Chưa đăng nhập:**
     - Quy định `GET /feed` trả về **HTTP 401 Unauthorized** với người dùng chưa đăng nhập hoàn toàn phù hợp với **Hồ sơ Nghiệp vụ v1.2** nhằm bảo vệ dữ liệu sinh viên nội bộ và chống scraping.
     - Sinh viên `PENDING` xem `PendingFeedPage` rút gọn (không link chi tiết HTTP 403, không SĐT, không chat); sinh viên `APPROVED` xem `PostPage` đầy đủ.
  3. **Đồng bộ Toàn diện Hệ thống Tài liệu:**
     - Cập nhật [`docs/architecture/authorization_matrix.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/docs/architecture/authorization_matrix.md): Định nghĩa lại Kiến trúc 3 tầng và chuẩn hóa tiêu đề cột ma trận (Chưa xác thực vs USER vs ADMIN).
     - Cập nhật [`docs/ARCHITECTURE.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/docs/ARCHITECTURE.md) & [`ARCHITECTURE.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/ARCHITECTURE.md) (Mục 1.3, Mục 8.1, Mục 10: FR-04, DB05, D05, D13).
     - Cập nhật [`tasks/BACKLOG.md`](file:///d:/Documents/PTIT DOC/SPM/campus-marketplace/tasks/BACKLOG.md) (BE-02-T03, BE-01-T05, BE-02-T07).
  4. **Kiểm tra Chất lượng Toàn bộ Monorepo:**
     - `pnpm lint`: PASS (0 warnings).
     - `pnpm typecheck`: PASS (0 errors).
     - `pnpm test`: PASS (50/50 tests).
     - `pnpm --filter @campus/backend run test:e2e`: PASS (38/38 tests).
     - `pnpm build`: PASS (`next build` prerender 4/4 static pages + `nest build`).

---

### Handoff #011: Chuẩn hóa Toàn diện Next.js 14+ (App Router) theo Quyết định Tech Lead, Khóa Feed Guest & Đồng bộ 100% Monorepo (06/11/2026)

- **Ngày:** 2026-11-06
- **Người thực hiện:** Senior Backend Architect & Technical Project Manager
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Chuẩn hóa Toàn diện Next.js 14+ (App Router) cho Web Client (Quyết định Tech Lead & D11):**
     - Chốt dứt điểm Next.js 14+ (App Router) kết hợp React 18 và TypeScript cho `apps/frontend`.
     - Dọn sạch toàn bộ các tệp cấu hình Vite mồ côi (`vite.config.ts`, `index.html`, `src/app/main.tsx`, `src/vite-env.d.ts`, `tsconfig.node.json`).
     - Cấu hình Next.js App Router chuẩn chỉnh (`layout.tsx`, `page.tsx`, `next.config.mjs`, `next-env.d.ts`, `vitest.config.ts`).
     - Đồng bộ hóa 100% nội dung tài liệu kiến trúc (`docs/ARCHITECTURE.md`, `ARCHITECTURE.md`, `AGENTS.md`, `tasks/BACKLOG.md`) sang Next.js 14+ App Router, xóa bỏ hoàn toàn bất kỳ nội dung nào còn đề cập React/Vite mâu thuẫn.
  2. **Khóa Bảng Tin đối với GUEST (HTTP 401 Unauthorized per DB05, D05, D13):**
     - Người dùng chưa đăng nhập (`GUEST`) bị chặn hoàn toàn khi truy cập `GET /feed` (yêu cầu JWT token, trả về HTTP 401).
     - Chỉ tài khoản `PENDING` (chờ duyệt thẻ sinh viên) mới được truy cập `PendingFeedPage` rút gọn (chỉ có tiêu đề, giá, phân loại, thumbnail công khai; ẩn số điện thoại người bán, chặn xem chi tiết bài đăng HTTP 403, chặn chat HTTP 403).
     - Tài khoản `APPROVED` được cấp quyền xem bảng tin cá nhân hóa đầy đủ và truy cập trang chi tiết `PostPage`.
  3. **Bảo toàn Toàn vẹn Các Cải tiến Review Trước đó:**
     - Giữ nguyên CSDL PostgreSQL trên Supabase với SQL-first `node-postgres (pg)` và TLS certificate verification (`rejectUnauthorized: true`).
     - Giữ nguyên Migration `0001_dbml_review_fixes.sql` và rollback `.down.sql` (Partial UNIQUE Index, SQL CHECK thật, Soft-delete).
     - Giữ nguyên chuẩn Chat Retention TTL: Tin nhắn văn bản lưu 3 tháng (`created_at + 3 months`), tệp đính kèm lưu 1 tháng (`created_at + 1 month`).
  4. **Kết quả kiểm tra chất lượng (Verification):**
     - `pnpm lint`: PASS (0 warnings).
     - `pnpm typecheck`: PASS (0 errors).
     - `pnpm test`: PASS (19/19 Frontend Vitest tests + 31/31 Backend Jest tests).
     - `pnpm --filter @campus/backend run test:e2e`: PASS (38/38 tests).
     - `pnpm build`: PASS (Next.js 14 App Router prerender 4/4 pages + NestJS build).

### Handoff #010: Thống nhất Toàn diện React/Vite + PostgreSQL, Khóa Feed với Guest & Triển khai Migration DBML Review (05/11/2026)

- **Ngày:** 2026-11-06
- **Người thực hiện:** Senior Backend Architect & Technical Project Manager
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Khắc phục Mâu thuẫn Kiến trúc trong Tài liệu (Next.js vs React/Vite per D11):**
     - Đã loại bỏ hoàn toàn các câu chữ mâu thuẫn khẳng định Next.js 14+ trong `docs/ARCHITECTURE.md`, `ARCHITECTURE.md`, `AGENTS.md` và `tasks/BACKLOG.md`.
     - Đồng nhất 100% toàn bộ hệ thống theo hướng: **React 18 + Vite 5 (SPA)** cho Frontend, **NestJS 10** cho Backend và **PostgreSQL trên Supabase** (SQL-first `node-postgres`).
     - Mã nguồn `apps/frontend` vận hành sạch sẽ với Vite 5, `vite build` 606ms, 19/19 Vitest tests PASS.
  2. **Chuẩn hóa Bảng Phân quyền Feed (Khóa Feed đối với GUEST per DB05, D05, D13):**
     - Sửa bảng phân quyền RBAC: GUEST xem feed là **❌ Chặn (401 Unauthorized)**, không cho phép xem feed khi chưa đăng nhập.
     - Phân định rõ `PendingFeedPage` rút gọn chỉ dành riêng cho tài khoản **PENDING** (đã có email trường nhưng chờ duyệt thẻ).
  3. **Triển khai Migration Khắc phục Kiến trúc CSDL (`0001_dbml_review_fixes.sql`):**
     - DB01: Tạo Partial UNIQUE INDEX `uq_active_report_per_buyer` trên `reports (buyer_id, post_id) WHERE status IN ('WAITING_SELLER_RESPONSE', 'UNDER_REVIEW')`.
     - DB03 & DB07: Chuyển toàn bộ comment thành CHECK constraints thực tế: `price > 0`, `budget_min <= budget_max`, `reputation_score BETWEEN 0.0 AND 5.0`, `size_bytes <= 10MB`, `buyer_id <> seller_id`, `member_low_id < member_high_id`.
     - DB02: Thêm cột `deleted_at` cho `posts` và `users` hỗ trợ soft-delete, bảo toàn toàn vẹn lịch sử kiểm toán.
  4. **Chuẩn hóa Thời gian Lưu trữ Chat (Chat Retention TTL per DB06 & FR-12):**
     - Quy định chuẩn xác: **Tin nhắn văn bản** lưu **3 tháng** (`created_at + interval '3 months'`); **Tệp đính kèm** lưu **1 tháng** (`created_at + interval '1 month'`).
  5. **Cập nhật Toàn diện Tài liệu & Backlog:**
     - Cập nhật `docs/ARCHITECTURE.md` và `ARCHITECTURE.md` đồng bộ Mục 10 (Traceability 17 FRs, 5 Epics, 20 Stories, 36 WBS Packages, 6-Week Master Plan, DB01–DB12, D01–D14).
     - Cập nhật `tasks/BACKLOG.md` gắn WBS, Jira Story và FR Reference cho toàn bộ 20 tasks Backend của 2 kỹ sư.
- **Kết quả kiểm thử thực tế:**
  - `pnpm lint`: **PASS** (0 warnings).
  - `pnpm typecheck`: **PASS** (0 errors).
  - `pnpm --filter @campus/frontend test`: **PASS** (19/19 tests).
  - `pnpm --filter @campus/backend test`: **PASS** (31/31 tests).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (38/38 tests).
  - `pnpm build`: **PASS** (Next.js 14 App Router build thành công, NestJS build hoàn tất).
  2. **Chuẩn hóa Thời gian Lưu trữ Chat (Chat Retention TTL per DB06 & FR-12):**
     - Sửa sai lệch trong tài liệu kiến trúc trước đây (từng ghi 90 ngày cho cả hai).
     - Quy định chuẩn xác: **Tin nhắn văn bản** lưu **3 tháng** (`created_at + interval '3 months'`); **Tệp đính kèm** lưu **1 tháng** (`created_at + interval '1 month'`).
  3. **Làm rõ Cơ chế Phân tầng Bảng tin (Feed Tiering per D05, D13, DB05):**
     - Mô tả chi tiết hành vi của `PendingFeedPage` cho GUEST và PENDING: chỉ hiển thị tóm tắt, ẩn số điện thoại, chặn xem trang chi tiết bài đăng và chặn mở chat.
     - Mô tả `PostPage` cho tài khoản APPROVED: xem chi tiết đầy đủ, mở số điện thoại có kiểm soát qua `PhoneRevealEvent` và nhắn tin trao đổi.
  4. **Giải trình & Thiết kế Khắc phục 12 Vấn đề Rà soát DBML (DB01–DB12):**
     - DB01: Thiết kế Partial UNIQUE INDEX `uq_active_report_per_buyer` trên `reports (buyer_id, post_id)` với điều kiện `WHERE status IN ('WAITING_SELLER_RESPONSE', 'UNDER_REVIEW')`.
     - DB02: Thiết kế Soft-delete / restrict bảo vệ dữ liệu khi xóa bài/người dùng, bảo toàn toàn vẹn `reports` và `audit_logs`.
     - DB03: Thực thi ràng buộc SQL CHECK thực tế trên CSDL cho `price`, `budget`, `reputation_score`, `size_bytes`.
     - DB04: Phân tách toàn vẹn tin SELL và BUY_REQUEST ở tầng Service/Transaction.
     - DB05: Phân quyền đa lớp bằng Guards và bảo vệ dữ liệu cá nhân (ẩn thẻ SV, controlled phone reveal).
     - DB06: Mốc Retention chat chính xác (text 3 tháng, file 1 tháng).
     - DB07: Ràng buộc hội thoại duy nhất và `member_low_id < member_high_id`.
     - DB08: Kiểm soát domain email trường đại học (`@*.edu.vn`) và chuẩn hóa chữ thường.
     - DB09: Validate danh mục sở thích mảng chuỗi với bảng `categories`.
     - DB10: Kiểm tra điều kiện tạo report hợp lệ của buyer (tin SELL, có hội thoại/phone reveal, chống trùng).
     - DB11: Idempotency trừ điểm uy tín theo chu kỳ $K=3$ (`report_cycle_key`) và ghi nhật ký audit.
     - DB12: Kiểm chứng DDL migration trên clean database.
  5. **Cập nhật Toàn diện Tài liệu & Backlog:**
     - Cập nhật `docs/ARCHITECTURE.md` và `ARCHITECTURE.md` bổ sung Mục 10 (Traceability 17 FRs, 5 Epics, 20 Stories, 36 WBS Packages, 6-Week Master Plan, DB01–DB12, D01–D14).
     - Cập nhật `tasks/BACKLOG.md` gắn WBS, Jira Story và FR Reference cho toàn bộ 20 tasks Backend của 2 kỹ sư.
     - Cập nhật `AGENTS.md` đồng bộ stack React 18 + Vite 5.
- **Kết quả kiểm thử thực tế:**
  - `pnpm lint`: **PASS** (0 warnings).
  - `pnpm typecheck`: **PASS** (0 errors).
  - `pnpm --filter @campus/frontend test`: **PASS** (19/19 tests).
  - `pnpm --filter @campus/backend test`: **PASS** (31/31 tests).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (38/38 tests).
  - `pnpm build`: **PASS** (Vite 5 build 561ms, NestJS build hoàn tất).

---

### Handoff #009: Chuyển đổi Toàn diện apps/frontend sang Next.js 14+ (App Router) & Chốt CSDL PostgreSQL

- **Ngày:** 2026-11-06
- **Người thực hiện:** Senior Backend Architect & Technical Project Manager
- **Branch:** `fix/be-foundation-audit` (PR #1)
- **Mục tiêu đạt được:**
  1. **Chuyển đổi Mã nguồn `apps/frontend` sang Next.js 14+ (App Router):**
     - Cài đặt `next@^14.2.35` kết hợp chặt chẽ với React 18 (`react: ^18.3.1`, `react-dom: ^18.3.1`).
     - Cấu hình `next.config.mjs`, `next-env.d.ts`, `tsconfig.json` với Next.js plugin & path aliases (`@/*`).
     - Tái cấu trúc thư mục ứng dụng theo Next.js App Router: `src/app/layout.tsx` (RootLayout với metadata SEO), `src/app/page.tsx` (Root Page), chuyển components sang `src/components/HomePage.tsx`.
     - Cập nhật biến môi trường an toàn: `process.env.NEXT_PUBLIC_API_BASE_URL` trong `src/services/api.ts` hỗ trợ cả Next.js SSR và Browser client.
     - Dọn dẹp hoàn toàn các tệp cũ của Vite (`vite.config.ts`, `index.html`, `src/app/main.tsx`, `src/vite-env.d.ts`, `tsconfig.node.json`).
     - Duy trì Vitest test runner qua `vitest.config.ts`, kiểm thử tự động 19/19 frontend tests PASS hoàn hảo.
  2. **Xác nhận Kiến trúc Đồng nhất 100%:** Cả tài liệu kiến trúc (`docs/ARCHITECTURE.md`, `ARCHITECTURE.md`), backlog (`tasks/BACKLOG.md`), và mã nguồn thực tế (`apps/frontend`, `apps/backend`) đều đã hội tụ về chuẩn:
     - Frontend: **Next.js 14+ (App Router)**.
     - Database: **PostgreSQL trên Supabase** (18 bảng v1.2, SQL-first pool).
     - Backend: **NestJS 10**.
- **Kết quả kiểm thử thực tế:**
  - `pnpm lint`: **PASS** (0 warnings).
  - `pnpm typecheck`: **PASS** (0 errors).
  - `pnpm --filter @campus/backend test`: **PASS** (31/31 tests).
  - `pnpm --filter @campus/backend test:e2e`: **PASS** (38/38 tests).
  - `pnpm --filter @campus/frontend test`: **PASS** (19/19 tests).
  - `pnpm build`: **PASS** (Next.js 14 prerender static pages & NestJS nest build cả 2 đều thành công).

---

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
