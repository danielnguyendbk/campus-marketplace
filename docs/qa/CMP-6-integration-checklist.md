# CMP-6 · Checklist kiểm thử tích hợp FE–BE–Database (FR-01 · AT-01)

> Task: **CMP-6 — API email OTP, tạo tài khoản & đăng nhập JWT** (liên kết FR-01, BR-01/02, AT-01).
> Loại công việc: **kiểm thử tích hợp**, không sửa mã nguồn trong `apps/`.

| Thông tin | Giá trị |
|---|---|
| Ngày chạy | 2026-11-13, 16:31–16:52 (GMT+7) |
| Nhánh | `feat/cmp-31` (commit nền `990583b`, không push/PR) |
| Backend | NestJS 10, `http://localhost:4000/api/v1` |
| Frontend | Next.js 14.2.35, `http://localhost:3000` |
| Database | Supabase PostgreSQL 17.11 (pooler, TLS verify bật, CA `database/supabase-ca.crt`) |
| Mail | `MAIL_TRANSPORT=smtp` (Gmail SMTP, thật) |
| Công cụ | Node `fetch` script, Playwright **tạm qua npx** (cài ngoài repo, không thêm dependency), `pg` của backend để đọc/đối soát DB |

## 1. Phạm vi

**Trong phạm vi:** 4 endpoint `/auth/*`, health smoke, CORS, luồng OTP → register → login → PENDING, dữ liệu bảng `otp_verifications` / `users`, đối chiếu `packages/api-contract/openapi.yaml`, quét rò rỉ secret/OTP.

**Ngoài phạm vi (theo quyết định #2 của kế hoạch):** `GET /me/verification`, trang `/verification`, `GET /feed`; video minh chứng do người dùng tự quay.

> Ghi chú về cách kiểm chứng OTP: phiên này dùng **SMTP thật** nên mã OTP không in ra log. Để tự động hoá bước `verify-otp`/`register`, mã đúng được **suy ra từ `code_hash`** bằng `OTP_HASH_SECRET` của môi trường local (HMAC-SHA256 email:code, 10^6 không gian khoá). Mã OTP **không** được ghi vào tài liệu, ảnh chụp hay log.

## 2. Bước 0 — Baseline tự động

| Lệnh (`npx -y pnpm@10.14.0 …`) | Kết quả | Chi tiết | Exit code |
|---|---|---|---|
| `lint` | PASS | 3/3 workspace, 0 warning | 0 |
| `typecheck` | PASS | 0 lỗi (BE, FE, api-contract) | 0 |
| `test` | PASS | Backend 13 suites / 74 tests; Frontend 2 files / 58 tests | 0 |
| `test:e2e` | PASS | Backend 4 suites / 40 tests (contract, error-envelope, auth, app) | 0 |
| `build` | PASS | `nest build` + `next build` (7 route) | 0 |

Bằng chứng: `docs/qa/evidence/CMP-6/baseline.log`.

## 3. Cấu hình môi trường (chỉ file local, không commit)

| File | Biến | Giá trị dùng khi test | Trạng thái git |
|---|---|---|---|
| `apps/backend/.env` | `PORT` | `4000` | gitignored |
| | `CORS_ORIGIN` | `http://localhost:3000` | gitignored |
| | `ALLOWED_SCHOOL_DOMAINS` | `student.ptithcm.edu.vn` | gitignored |
| | `MAIL_TRANSPORT` / OTP_* | `smtp` / mặc định 600-5-60-5 | gitignored |
| `apps/frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api/v1` | gitignored |
| | `NEXT_PUBLIC_AUTH_API_MODE` | không đặt (`live`) | gitignored |

`git status` chỉ có `docs/qa/` (mới) ⇒ không có file cấu hình nào lọt vào git.
Sau Pha D2, `DATABASE_URL` đã được **khôi phục nguyên bản** và backend khởi động lại thành công.

## 4. Smoke

| # | Kiểm tra | Kết quả | Ghi chú |
|---|---|---|---|
| S1 | `GET /api/v1/health` | **PASS** — 200, `database.status=connected`, `latencyMs≈303–310` | `docs/qa/evidence/CMP-6/backend.log` |
| S2 | CORS FE(3000) → BE(4000) | **PASS** — mọi call từ UI đi tới `http://localhost:4000`, không có lỗi CORS; `request-otp` 200 | `docs/qa/evidence/CMP-6/ui-A.json` (`apiCalls`) |
| S3 | Banner chế độ mock | **PASS** — không hiển thị banner mock ⇒ đang chạy `live` | ảnh `A3-register-otp-step.png` |
| S4 | FE `/register` render | **PASS** — HTTP 200, đúng tiếng Việt | ảnh `A1-email-format.png` |

## 5. Pha A — Negative trước đăng ký (email chưa có tài khoản)

| # | Tình huống | Kỳ vọng | HTTP thực tế | UI thực tế | Kết quả | Bằng chứng |
|---|---|---|---|---|---|---|
| A0 | Dữ liệu tồn đọng trước khi test | Sạch | Có sẵn **1 user PENDING + 1 OTP** từ phiên 2026-11-12 → đã xoá | — | PASS (đã dọn) | `api-phase-A.json` |
| A1 | Email sai định dạng | FE chặn; API → 400 | 400 `VALIDATION_FAILED`, `details[{field:"email"}]` | "Email chưa đúng định dạng." (chặn trước khi gọi API) | **PASS** | `A1-email-format.png` |
| A2 | Email ngoài miền trường | 400 `EMAIL_DOMAIN_NOT_ALLOWED`, thông báo tiếng Việt | 400 `EMAIL_DOMAIN_NOT_ALLOWED` | `abc@gmail.com` → FE chặn "Vui lòng sử dụng email trường có tên miền .edu.vn."; `abc@other.edu.vn` (lọt regex FE) → BE 400 "Email phải thuộc tên miền trường đại học được cho phép." | **PASS** | `A2-non-school-domain-fe.png`, `A2-email-domain-not-allowed-400.png` |
| A3 | "Gửi lại mã" ngay (<60s) | 429 `OTP_RATE_LIMITED` | 429 `OTP_RATE_LIMITED` | "Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại." | **PASS** | `A3-resend-cooldown-429.png` |
| A3b | Lần gửi đầu | 200 envelope, 1 dòng `otp_verifications`, chỉ `code_hash` | 200 `{success,data,timestamp}`; 1 dòng; `code_hash` 64 hex; **không** có cột plaintext | Bước OTP + thông báo trung tính | **PASS** | `A3-register-otp-step.png` |
| A4 | OTP sai 1 lần | 400 `OTP_INVALID`, `attempts=1` | 400 `OTP_INVALID`, `attempts=1` | "Mã OTP không hợp lệ hoặc đã hết hạn." | **PASS** | `A4-otp-invalid-once.png` |
| A5 | OTP sai đủ 5 lần | 4 lần 400 + lần 5: 429 `OTP_ATTEMPTS_EXCEEDED`, `attempts=5` | đúng như kỳ vọng, `attempts=5` | "Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại." (xem Bug CMP-6-02) | **PASS** | `A5-otp-attempts-exceeded.png` |
| A6 | OTP hết hạn (sửa `expires_at` về quá khứ) rồi nhập đúng | 400 `OTP_INVALID` | 400 `OTP_INVALID` (`expired_rows=1`) | "Mã OTP không hợp lệ hoặc đã hết hạn." | **PASS** | `A6-otp-expired.png` |
| A7 | `otpTicket` giả/sai chữ ký gọi `register` | 400 `OTP_TICKET_INVALID` | 400 `OTP_TICKET_INVALID` (cả JWT sửa chữ ký lẫn chuỗi rác) | Không tái hiện qua UI (ticket do server cấp) — đã kiểm ở tầng API | **PASS (API)** | `api-phase-A.json` |

## 6. Pha B — Happy path

| # | Hành động | Kỳ vọng | Thực tế (Network/DB) | UI | Kết quả | Bằng chứng |
|---|---|---|---|---|---|---|
| B1 | `/register`: email trường → "Gửi mã xác thực" | `request-otp` 200; 1 dòng `otp_verifications` chỉ chứa `code_hash`; mail gửi đi | 200 envelope; 1 dòng, `verified_at=NULL`, `attempts=0`; log `Dispatched OTP email … via SMTP` | Sang bước OTP, thông báo trung tính | **PASS** (nội dung mail: xem mục 11) | `B1-register-otp-step.png` |
| B2 | Nhập OTP → "Xác thực OTP" | 200 `{otpTicket, expiresIn}`; `verified_at` được set | 200, `expiresIn=600`, `verified_at` có giá trị, response không chứa `code_hash` | Sang bước mật khẩu | **PASS** | `B2-verify-otp-password-step.png` |
| B3 | Tên hiển thị + mật khẩu ≥ 8 ký tự → "Tạo tài khoản" | `register` **201**, `role=USER`, `verificationStatus=PENDING`; DB `verification_status=PENDING`, `password_hash` bcrypt | **201**; user `USER/PENDING`; DB `$2b$12$…` (60 ký tự); không trả hash/mật khẩu | Chuyển `/verification`, header có "Nguyen Van A", **không** lưu token vào `localStorage`/`sessionStorage`/cookie | **PASS** | `B3-registered-verification-screen.png` |
| B4 | Tải lại → `/login` đăng nhập đúng | `login` 200 `verificationStatus=PENDING` | 200, JWT `typ=access`, `role=USER`, `exp=iat+3600` | Trang chủ hiển thị "Tài khoản đang chờ xác thực sinh viên" (PENDING) | **PASS** | `B4-login-session-pending.png` |

## 7. Pha C — Negative sau đăng ký (email đã có tài khoản)

| # | Tình huống | Kỳ vọng | Thực tế | Kết quả | Bằng chứng |
|---|---|---|---|---|---|
| C1 | `request-otp` cho email đã đăng ký | 200 thông điệp trung tính, **không** gửi mail, không lộ tài khoản tồn tại | 200 "Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi."; số dòng OTP **không đổi** (1→1); số lần dispatch SMTP không tăng (3→3) | **PASS** | `C1-request-otp-registered-email.png` |
| C2 | Dùng lại `otpTicket` của B2 để đăng ký lần 2 | 4xx (409/422) | **409** `EMAIL_ALREADY_REGISTERED`, số user vẫn = 1 | **PASS** | `api-phase-C.json` |
| C3 | Login sai mật khẩu | 401 | 401 `INVALID_CREDENTIALS` — "Email hoặc mật khẩu không chính xác." | **PASS** | `C3-login-wrong-password.png` |
| C4 | Login email không tồn tại | 401, cùng thông điệp với C3 | 401 `INVALID_CREDENTIALS`, **cùng code và cùng message** | **PASS** | `C4-login-unknown-email.png` |
| C5 | Mật khẩu < 8 ký tự | FE chặn; API → 400 có `details.field` | API: 400 `VALIDATION_FAILED`, `details[{field:"password"}]`; FE có validate `minLength 8` + kiểm tra xác nhận mật khẩu (không tái hiện qua UI được vì bước mật khẩu chỉ mở khi có `otpTicket` hợp lệ mà email đã đăng ký) | **PASS (API + code FE)** | `api-phase-C.json` |

## 8. Pha D — Lỗi hạ tầng

| # | Tình huống | Kỳ vọng | Thực tế | Kết quả | Bằng chứng |
|---|---|---|---|---|---|
| D1 | Tắt BE rồi thao tác trên UI | UI báo lỗi kết nối, không treo | Sau **2,55s**: "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại."; không treo, nút trở lại bình thường | **PASS** | `D1-backend-down.png`, `ui-D1.json` |
| D2 | Đặt sai `DATABASE_URL` tạm thời rồi khởi động lại BE | 500, thông điệp an toàn, không lộ stack/`exception.message`/cấu hình DB | `login` và `request-otp` → **500** `{"error":{"code":"INTERNAL_SERVER_ERROR","message":"Internal server error"}}`, không `details`, không stack/URI; **`/health` thì lộ message driver** (xem Bug CMP-6-01) | **PASS** (có bug riêng cho health) | `api-phase-D.json`, `backend-d2.log` |
| D2b | Khôi phục cấu hình | `.env` nguyên bản, BE healthy | Đã khôi phục; `health` → `database.status=connected` (16:51) | **PASS** | `backend.log` (mục restart sau D2) |

## 9. Đối chiếu API Contract (`packages/api-contract/openapi.yaml`)

| Endpoint | Status thực | Success/Error envelope | Schema dữ liệu | Kết luận |
|---|---|---|---|---|
| `POST /auth/request-otp` | 200 / 400 / 429 | `{success,data,timestamp}` đúng; lỗi `{error:{code,message,details?}}` (+`requestId` không có — là optional) | `data` = `SimpleMessage{success,message}` | **Khớp** |
| `POST /auth/verify-otp` | 200 / 400 / 429 | đúng | `data` = `{otpTicket, expiresIn}`; không trả `codeHash` | **Khớp** |
| `POST /auth/register` | **201** / 400 / 409 | đúng | `data` = `AuthSession{accessToken,tokenType:"Bearer",expiresIn,user{id,displayName,role,verificationStatus}}` | **Khớp** |
| `POST /auth/login` | 200 / 401 | đúng | `AuthSession`, `verificationStatus=PENDING` | **Khớp** |
| `GET /health` | 200 | envelope success | **không có trong contract** | Lệch (xem mục 12) |

- Không có trường thừa ở top-level (kiểm bằng so khớp `Object.keys`), `ValidationErrorDetail` đúng `{field,message}`.
- Register trả **201** đúng hợp đồng; nhánh **422** của contract không được BE dùng (BE dùng 400/409) — chấp nhận được theo contract nhưng FE có nhánh xử lý 422 (dead code).
- Lỗi spec phát hiện: `ErrorEnvelope.error.details` dùng `additional: false` thay vì `additionalProperties: false` (Bug CMP-6-03).

## 10. Quét rò rỉ secret / OTP

Quét `backend.log` + `backend-d2.log` (giải mã cả UTF-8/UTF-16/latin-1) với 10 mẫu: mật khẩu test, SMTP app password, DB password, `eyJ…` (JWT), `DATABASE_URL=`, `postgres://`, `[DEV MAIL]`, `OTP=<số>`, `Bearer …`, `$2b$12$`.

**Kết quả: 0 hit / CLEAN.** Bổ sung đã kiểm tra độc lập:

| Kiểm tra | Kết quả |
|---|---|
| Response `request-otp`/`verify-otp` chứa OTP/code_hash? | Không (đối chiếu `Object.keys` + so khớp giá trị `code_hash`) |
| OTP plaintext trong log? | Không (dùng `smtp`, không có `[DEV MAIL]`, không có `OTP=`) |
| Mật khẩu plaintext trong DB/log/response? | Không (DB chỉ có `$2b$12$…`) |
| Token trong `localStorage`/`sessionStorage`/cookie? | Không (B3: cả 3 rỗng) |
| URL chứa mật khẩu? | Không |

## 11. Việc cần bạn làm khi quay video (bằng chứng bổ sung)

1. Reset dữ liệu test trước khi quay (SQL đúng tên bảng thật — kế hoạch ghi `email_otps`/`status`, thực tế là `otp_verifications`/`verification_status`):
   ```sql
   DELETE FROM public.otp_verifications WHERE email = 'n23dccn162@student.ptithcm.edu.vn';
   DELETE FROM public.users             WHERE school_email = 'n23dccn162@student.ptithcm.edu.vn';
   ```
2. Chạy lại B1–B4, quay màn hình; chụp thêm **ảnh nội dung email OTP (template mới)** — mục duy nhất chưa có bằng chứng trực quan trong phiên này (mới xác nhận qua log `Dispatched OTP email … via SMTP`).
3. Giữ `apps/backend/.env` (PORT=4000, CORS=3000) và `apps/frontend/.env.local` như hiện tại; nếu muốn dừng server: tắt tiến trình node đang nghe cổng 4000/3000.

> Trạng thái DB cuối phiên: 1 user `n23dccn162@student.ptithcm.edu.vn` (`USER`, `PENDING`, `password_hash` bcrypt) + 1 dòng `otp_verifications` đã `verified_at` — dùng để chứng minh B3/B4; xoá theo SQL trên nếu muốn quay lại từ đầu.

## 12. Quan sát & đề xuất (không chặn luồng chính)

| # | Quan sát | Đề xuất |
|---|---|---|
| O1 | Sau đăng ký, FE chuyển `/verification` và gọi `GET /me/verification` → **404** (BE mới có Auth + Health). Người dùng thấy "Chưa thể hoàn thành yêu cầu. Vui lòng thử lại." Trang chủ PENDING hiển thị đúng trạng thái nhưng phần feed cũng lỗi vì `GET /feed` chưa có. | Nằm ngoài phạm vi CMP-6; cần BE-02-T01 (`/me/evidence`, `/me/verification`) và BE-02-T07 (`/feed`) trước khi demo trọn luồng PENDING. Nên ghi nhận vào Jira của 2 task đó, không phải bug của CMP-6. |
| O2 | `GET /health` trả `database.message` thô của driver (`password authentication failed for user "postgres"`) và **không có trong OpenAPI** | Sanitize message khi `disconnected`; bổ sung `/health` vào contract hoặc tài liệu vận hành. Bug CMP-6-01. |
| O3 | FE validate miền trường bằng regex cứng `.edu.vn` trong khi BE dùng allowlist cấu hình được (`ALLOWED_SCHOOL_DOMAINS`) | Cho FE đọc allowlist từ cấu hình/công bố công khai, hoặc chấp nhận để server quyết định (hiện server vẫn là nguồn chân lý, an toàn). |
| O4 | Mọi lỗi 429 đều hiển thị "Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại.", kể cả `OTP_ATTEMPTS_EXCEEDED` (cần "yêu cầu mã mới") | Ưu tiên hiển thị `error.message` của BE cho 400/409/422/429 hoặc phân nhánh theo `error.code`. Bug CMP-6-02. |
| O5 | `docs/api/auth.http`, `.env.example`, `README` của FE/BE còn hard-code cổng 3000 | Theo kế hoạch, không sửa trong task này; nên tạo ticket cấu hình riêng (BE/FE thuộc quyền sở hữu khác nhau). |
| O6 | Contract có `additional: false` (sai tên thuộc tính) trong `ErrorEnvelope.details` | Sửa thành `additionalProperties: false`. Bug CMP-6-03. |
| O7 | Nhánh 422 của `register` không được BE dùng; FE vẫn có code xử lý 422 | Hoặc BE chuẩn hoá lỗi nghiệp vụ về 422, hoặc FE bỏ nhánh 422 khi chốt contract. |

## 13. Kết luận

**Tổng hợp:** 41 mục kiểm (25 mục API/DB: S1–S4, A0–A7, B1–B4, C1–C5, D1–D2b; 16 mục UI qua Playwright) → **40 đạt**, **1 phát hiện lỗi** (trong D2: `GET /health` lộ message driver PostgreSQL — đã thành Bug CMP-6-01). Không có mục nào chặn luồng chính.

| Tiêu chí Done theo kế hoạch | Kết quả |
|---|---|
| B1–B4 Pass | **Đạt** (B1 phần nội dung mail: chờ ảnh từ bạn) |
| A2–A5 Pass | **Đạt** |
| C1–C4 Pass | **Đạt** |
| Quét log = 0 | **Đạt** (CLEAN) |
| Bug còn lại không chặn luồng chính + có nội dung Jira | **Đạt** — 3 bug Minor/không chặn, soạn sẵn trong `docs/qa/CMP-6-jira-bug-drafts.md` |

**Trạng thái: DONE** cho phạm vi kiểm thử tích hợp (A1–A7, B1–B4, C1–C5, D1–D2). Không có blocker. Hai điểm cần người dùng bổ sung: **ảnh nội dung email OTP** khi quay video và quyết định có tạo Jira cho O1/O5 hay không.

## 14. Danh mục bằng chứng (local, không commit)

```
docs/qa/evidence/CMP-6/
├── baseline.log              # lint/typecheck/test/test:e2e/build
├── backend.log               # log BE phiên chính (SMTP dispatch, mã lỗi)
├── backend-d2.log            # log BE khi DATABASE_URL sai
├── frontend.log              # log next dev
├── api-phase-A.json          # A0–A7 (HTTP + DB)
├── api-phase-B.json          # B1–B4
├── api-phase-C.json          # C1–C5
├── api-phase-D.json          # D2 health/login/request-otp
├── ui-A.json / ui-B.json / ui-B4.json / ui-C.json / ui-D1.json
└── screens/*.png             # 17 ảnh chụp UI (16 ảnh theo kịch bản + `ERROR-D1.png` chụp lúc BE vừa tắt)
```

> Các file trên chứa email sinh viên, log/ảnh ⇒ **không commit** (đúng quy định bảo mật). Chỉ 2 file markdown trong `docs/qa/` là tài liệu bàn giao.
