## 1. Task liên quan

- Task: [CMP-29 — Giao diện đăng ký OTP và đăng nhập](https://chauviplong1701.atlassian.net/browse/CMP-29)
- Truy vết: CMP-6, FR-01, UI-01; đề xuất size M, chờ PM chốt.
- Nhánh: `feat/fe-cmp-29-auth-ui` → `develop`.
- Tiêu đề PR: `feat(frontend): add OTP auth and pending student flow (CMP-29)`.

## 2. Phạm vi thay đổi

- [x] Frontend (`apps/frontend`)
- [ ] Backend (`apps/backend`)
- [ ] Database Schema / Migrations (`database`)
- [ ] API Contract (`packages/api-contract`)
- [x] Tài liệu & dependency phục vụ FE build

Thêm `/register` và `/login` với giao diện chung navy/vàng. Đăng ký đi từ email trường đến OTP và chỉ mở tạo mật khẩu sau khi nhận ticket hợp lệ. Xử lý loading, validation, OTP sai/hết hạn, gửi lại, giới hạn yêu cầu, email trùng và lỗi mạng. Đăng ký thành công nhận `USER/PENDING`, chuyển đến `/verification`; đăng nhập chuyển về trang chủ `/`, riêng `REJECTED` đến hồ sơ để bổ sung.

Typed auth service gọi bốn endpoint trong OpenAPI qua API client hiện có. Dùng chung phiên trong bộ nhớ và token để lấy feed rút gọn, xem trạng thái và nộp hồ sơ multipart theo contract. Thay trang bootstrap ở `/` bằng màn hình đích sau auth; `PENDING` chỉ xem tóm tắt, không có link chi tiết/search/chat/post. Nộp hồ sơ vẫn chờ Admin duyệt, không tự cấp quyền. Trang đích này chưa triển khai Marketplace đầy đủ cho APPROVED.

Mock adapter đi qua cùng kiểm tra envelope, chỉ bật bằng biến môi trường rõ ràng và có nhãn trên UI; không fallback sang mock khi backend thật lỗi. Token mock và thật tách biệt. Hết phiên, HTTP 401 hoặc đăng xuất sẽ xóa phiên; chưa lưu phiên qua reload. Ảnh thẻ không hiển thị lại sau nộp hoặc sau duyệt.

## 3. Các file chính bị thay đổi

- `apps/frontend/src/app/(auth)/`: layout, login và register routes.
- `apps/frontend/src/app/page.tsx`, `src/app/verification/page.tsx`: bảng tin và hồ sơ sau auth.
- `apps/frontend/src/features/auth/`: form, kiểu dữ liệu, auth service, mock adapter, CSS và hướng dẫn chạy.
- `apps/frontend/src/features/marketplace/`: service/types, giao diện bảng tin giới hạn, nộp hồ sơ và trạng thái duyệt.
- `apps/frontend/src/services/api.ts`: transport tùy chọn và hỗ trợ FormData, giữ nguyên kiểm tra envelope.
- `apps/frontend/src/test/App.test.tsx`, `src/test/api.test.ts`: mở rộng hai file test hiện có.
- `apps/frontend/package.json`, `pnpm-lock.yaml`: khai báo trực tiếp `@types/node@20.19.43` cần cho build FE.
- `tasks/AGENT_HANDOFF.md`: bàn giao CMP-29.

## 4. Kết quả kiểm thử đã thực hiện

- [x] FE lint: PASS, 0 warnings.
- [x] FE typecheck: PASS.
- [x] FE Vitest: 58/58 PASS (19 nền tảng + 39 auth/điều hướng/quyền/hồ sơ), không tạo file test mới.
- [x] FE Next.js production build: PASS, có `/`, `/login`, `/register`, `/verification`.
- [ ] Backend unit/E2E: chưa kiểm chứng lại cục bộ vì giới hạn môi trường; chờ kết quả CI toàn monorepo cho PR này.
- [ ] Kiểm tra thủ công desktop/mobile: chờ xác nhận trước khi chuyển PR sang Ready for review.
- [ ] Tích hợp auth backend và OTP email thật: chưa xác nhận, tiếp tục ở CMP-31.

Lệnh kiểm chứng FE thực tế (tại `apps/frontend`, gọi trực tiếp các CLI của dependency đã cài):

```powershell
node node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vitest/vitest.mjs run --no-cache
node node_modules/next/dist/bin/next build
```

Next build có cảnh báo cấu hình ESLint chưa có Next plugin; không sửa cấu hình này trong CMP-29.

## 5. Ảnh hưởng tới Database / API Contract

- [x] Không có thay đổi CSDL hoặc API Contract.
- [ ] Có bổ sung Migration.
- [ ] Có cập nhật OpenAPI Contract.

Contract chuẩn: `packages/api-contract/openapi.yaml`, success `{ success: true, data, timestamp }`, error `{ error: { code, message, details? }, requestId? }`.

## 6. Các việc còn tồn đọng (To-do / Follow-up)

- [ ] Người dùng chạy mock và xác nhận UI desktop/mobile theo `README.md` trong cùng thư mục.
- [ ] CMP-31: đối chiếu allowlist email trường, CORS, rate limit, lỗi, OTP SMTP, feed giới hạn, multipart và quyền server thực tế cùng BE.
- [ ] Chạy các kiểm tra toàn monorepo/CI trước khi merge.
- [ ] Có review và CI xanh trước khi merge về `develop` và đóng CMP-29.

PR giữ trạng thái Draft cho đến khi hoàn tất kiểm tra giao diện. Chưa đánh dấu CMP-29 Done hoặc tuyên bố CMP-31 hoàn tất.
