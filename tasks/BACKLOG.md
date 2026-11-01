# Campus Marketplace - Product & Technical Backlog

## Phase 0: Repository Bootstrap & Foundation (Hiện tại)
- [x] **BOOTSTRAP-01:** Khởi tạo Monorepo với pnpm workspace (`apps/frontend`, `apps/backend`, `packages/api-contract`).
- [x] **BOOTSTRAP-02:** Đồng bộ Baseline Database Schema v1.2 (18 bảng) vào `database/baseline/schema_v1.2.sql`.
- [x] **BOOTSTRAP-03:** Đồng bộ OpenAPI 3.x contract v1.2 (49 endpoints) vào `packages/api-contract/openapi.yaml`.
- [x] **BOOTSTRAP-04:** Thiết lập quy chế AI Agent (`AGENTS.md` ở Root, Frontend, Backend, Database).
- [x] **BOOTSTRAP-05:** Cấu hình CI/CD GitHub Actions kiểm tra Lint, Test, Typecheck, Build.
- [x] **BOOTSTRAP-06:** Khởi tạo ứng dụng Frontend React + Vite + TypeScript chạy được.
- [x] **BOOTSTRAP-07:** Khởi tạo ứng dụng Backend NestJS + TypeScript với `GET /health` và SQL-first PostgreSQL pool layer.

---

## Phase 1: Authentication & User Verification (Đề xuất tiếp theo)
- [ ] **BE-AUTH-01:** Triển khai gửi OTP qua email trường sinh viên và xác thực mã OTP (`otp_verifications`).
- [ ] **BE-AUTH-02:** Triển khai đăng ký/đăng nhập, mã hóa bcrypt `password_hash`, cấp JWT token.
- [ ] **BE-AUTH-03:** Triển khai upload và quản lý minh chứng sinh viên (`student_evidences`).
- [ ] **BE-AUTH-04:** Triển khai API duyệt thẻ sinh viên dành cho Admin (`admin/verifications`).
- [ ] **FE-AUTH-01:** Màn hình Đăng ký / Xác thực OTP email sinh viên.
- [ ] **FE-AUTH-02:** Màn hình Đăng nhập và lưu trữ phiên JWT.
- [ ] **FE-AUTH-03:** Màn hình Gửi minh chứng sinh viên (Upload thẻ SV).
- [ ] **FE-AUTH-04:** Giao diện phê duyệt minh chứng dành cho Admin.

---

## Phase 2: Category & Post Listings (Đề xuất tiếp theo)
- [ ] **BE-POST-01:** API Danh mục hàng hóa (`GET /categories`) kèm seed dữ liệu chuẩn.
- [ ] **BE-POST-02:** API Đăng tin bán (`POST /posts` loại `SELL`, kèm `sell_details` và `post_images`).
- [ ] **BE-POST-03:** API Đăng tin cần mua (`POST /posts` loại `BUY_REQUEST`, kèm `buy_request_details`).
- [ ] **BE-POST-04:** API Tìm kiếm và lọc bài đăng theo danh mục, khoảng giá, từ khóa, sắp xếp.
- [ ] **FE-POST-01:** Trang chủ hiển thị danh sách bài đăng dạng lưới và bộ lọc danh mục.
- [ ] **FE-POST-02:** Form đăng tin bán đồ cũ (chọn ảnh, nhập giá, chọn tình trạng hàng).
- [ ] **FE-POST-03:** Form đăng tin tìm mua đồ dùng sinh viên.
- [ ] **FE-POST-04:** Trang chi tiết bài đăng và thông tin người bán.

---

## Phase 3: Communication & Trust/Safety (Tương lai)
- [ ] **BE-CHAT-01:** Quản lý hội thoại gắn với bài đăng (`conversations`, `messages`, `attachments`).
- [ ] **BE-CHAT-02:** Sự kiện xin và ghi nhận xem số điện thoại an toàn (`phone_reveal_events`).
- [ ] **BE-SAFETY-01:** Hệ thống báo cáo vi phạm bài đăng (`reports`).
- [ ] **BE-SAFETY-02:** Tích luỹ và trừ điểm uy tín (`reputation_events`).
- [ ] **FE-CHAT-01:** Giao diện nhắn tin trao đổi đồ cũ giữa sinh viên.
- [ ] **FE-SAFETY-01:** Modal báo cáo tin đăng vi phạm.
