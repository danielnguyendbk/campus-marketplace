# CMP-6 · Bản nháp Bug theo mẫu Jira

> Nội dung soạn sẵn để dán vào Jira (Issue Type: Bug). Chỉ gồm lỗi thật sự phát hiện trong phiên kiểm thử 2026-11-13.
> Môi trường chung: **Local, BE:4000, FE:3000, Supabase, `MAIL_TRANSPORT=smtp`, nhánh `feat/cmp-31` (commit nền `990583b`)**.
> Ảnh/log đính kèm nằm ở `docs/qa/evidence/CMP-6/` — **không commit**, chỉ đính kèm trực tiếp vào Jira sau khi che email/OTP/token.

---

## Bug 1 (CMP-6-01) — `GET /health` làm lộ thông điệp lỗi driver PostgreSQL

```
Issue Type: Bug
Summary: [CMP-6][BE] /health trả nguyên văn exception.message của PostgreSQL khi mất kết nối DB
Priority: Minor
Linked issue: relates to CMP-6 (FR-01, AT-01)
Components: Backend
Environment: Local, BE:4000, FE:3000, Supabase, MAIL_TRANSPORT=smtp, nhánh feat/cmp-31 (commit 990583b)
```

**Steps to Reproduce**
1. Sao lưu `apps/backend/.env`.
2. Đổi tạm `DATABASE_URL` sang một mật khẩu sai (giữ nguyên host/pooler Supabase) rồi khởi động lại BE (`pnpm --filter @campus/backend dev`).
3. `GET http://localhost:4000/api/v1/health`.
4. Khôi phục `apps/backend/.env` và khởi động lại BE.

**Expected (trích DoD/AGENTS §5, §7 và Security Directives)**
Phản hồi chẩn đoán chỉ nêu trạng thái (`status: "disconnected"`), **không** tiết lộ `exception.message`, thông tin user/role, hay chi tiết driver CSDL. `AGENTS.md` §5: "Tuyệt đối không tiết lộ `exception.message`, cấu hình database hay stack trace".

**Actual**
```json
{"success":true,"data":{"status":"degraded","database":{
  "status":"disconnected",
  "message":"password authentication failed for user \"postgres\""}},"timestamp":"…"}
```
- `PostgresService.checkHealth()` trả `error.message` thô (`apps/backend/src/database/postgres.service.ts`).
- Ghi nhận thêm: `/health` **không có trong** `packages/api-contract/openapi.yaml` (41 path) dù đang được dùng cho smoke test/ops.

**Attachments**
`api-phase-D.json`, `backend-d2.log` (đã che secret).

**Suggested owner:** BE Lead
**Gợi ý khắc phục:** khi `disconnected`, trả message cố định (vd. `"Database unavailable"`) và chỉ log chi tiết ở server; cân nhắc bổ sung `/health` vào OpenAPI hoặc tài liệu vận hành.

---

## Bug 2 (CMP-6-02) — Lỗi 429 `OTP_ATTEMPTS_EXCEEDED` hiển thị sai hướng dẫn cho người dùng

```
Issue Type: Bug
Summary: [CMP-6][FE] Mọi lỗi 429 đều hiện "Bạn đã yêu cầu quá nhiều lần…" kể cả khi đã nhập sai OTP quá 5 lần
Priority: Minor
Linked issue: relates to CMP-6 (FR-01, AT-01) — case A5 trong checklist
Components: Frontend
Environment: Local, BE:4000, FE:3000, Supabase, MAIL_TRANSPORT=smtp, nhánh feat/cmp-31 (commit 990583b)
```

**Steps to Reproduce**
1. `/register`: nhập email `n23dccn162@student.ptithcm.edu.vn`, bấm "Gửi mã xác thực".
2. Nhập OTP sai 5 lần liên tiếp.
3. Quan sát thông báo lỗi ở bước OTP.

**Expected (trích BR/contract)**
BE trả `429 OTP_ATTEMPTS_EXCEEDED` với message "Bạn đã nhập sai OTP quá số lần cho phép. **Vui lòng yêu cầu mã mới.**" — UI cần hướng dẫn người dùng **gửi lại mã**, không phải "chờ một lát".

**Actual**
UI hiển thị "Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại." (cùng câu với cooldown `OTP_RATE_LIMITED`), do `authErrorMessage()` gộp mọi `status === 429` (`apps/frontend/src/features/auth/api.ts`). Người dùng nhập đúng OTP vẫn bị từ chối và không biết phải bấm "Gửi lại mã".

**Attachments**
`screens/A5-otp-attempts-exceeded.png`.

**Suggested owner:** FE Lead
**Gợi ý khắc phục:** với `429`, ưu tiên `error.message` từ BE hoặc phân nhánh theo `error.code` (`OTP_ATTEMPTS_EXCEEDED` vs `OTP_RATE_LIMITED`).

---

## Bug 3 (CMP-6-03) — `ErrorEnvelope.error.details` khai báo sai thuộc tính trong OpenAPI

```
Issue Type: Bug
Summary: [CMP-6][Spec] ErrorEnvelope.details dùng "additional: false" thay vì "additionalProperties: false"
Priority: Minor
Linked issue: relates to CMP-6 (FR-01, AT-01)
Components: API Contract
Environment: packages/api-contract/openapi.yaml (nhánh feat/cmp-31, commit 990583b)
```

**Steps to Reproduce**
1. Mở `packages/api-contract/openapi.yaml`, tìm `components.schemas.ErrorEnvelope` (khoảng dòng 2574–2605).
2. Xem `error.details.items`.

**Expected (theo chuẩn OpenAPI 3.x và quy ước `additionalProperties: false` dùng xuyên suốt file)**
```yaml
details:
  type: array
  items:
    type: object
    properties: { field: {type: string}, message: {type: string} }
    additionalProperties: false
```

**Actual**
```yaml
details:
  type: array
  items:
    type: object
    properties: { field: …, message: … }
    additional: false        # sai tên khoá ⇒ bị bỏ qua khi validate
```
Hệ quả: validator/Apidog không chặn được trường thừa trong `details[]`, làm mất hiệu lực ràng buộc "nghiêm cấm trả trường thừa" ở đúng chỗ BE trả lỗi validate (`{field,message}`).

**Suggested owner:** Tech Lead / Architect (chủ sở hữu `packages/api-contract/`)
**Gợi ý khắc phục:** sửa khoá thành `additionalProperties: false`, chạy lại `pnpm --filter @campus/backend test:e2e` (bộ `contract-schemas.e2e-spec.ts`) và đồng bộ lên Apidog.

---

## Ghi nhận ngoài phạm vi (không tạo Bug CMP-6)

`GET /api/v1/me/verification` và `GET /api/v1/feed` hiện trả **404** vì BE Sprint 1 mới có `AuthModule` + `HealthModule`. Vì vậy ngay sau khi đăng ký, FE chuyển `/verification` và hiển thị "Chưa thể hoàn thành yêu cầu. Vui lòng thử lại."; trang chủ PENDING hiển thị đúng trạng thái nhưng phần nội dung feed báo lỗi. Đây là **khoảng trống phạm vi đã biết** (thuộc `BE-02-T01` và `BE-02-T07`), không phải hồi quy của CMP-6 — nên ghi chú vào 2 task đó thay vì mở bug tại đây.
