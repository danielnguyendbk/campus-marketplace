# Database Agent Guidelines - Campus Marketplace

Tài liệu này là quy chuẩn bắt buộc dành cho mọi AI Agent và lập trình viên thao tác với cơ sở dữ liệu của dự án **Campus Marketplace**.

---

## 1. Nguyên tắc cốt lõi & Source of Truth

- **Hệ quản trị CSDL:** PostgreSQL (triển khai trên cloud Supabase, database mặc định `postgres`, schema `public`).
- **Phiên bản thiết kế hiện tại:** v1.2 (18 bảng từ dbdiagram.io, được lưu trữ tại `database/baseline/schema_v1.2.sql`).
- **18 bảng hiện có:**
  1. `users` (tài khoản người dùng, phân quyền `user_role`, trạng thái `verification_status`)
  2. `otp_verifications` (xác thực OTP đăng ký sinh viên)
  3. `student_evidences` (minh chứng sinh viên, bảo vệ quyền riêng tư)
  4. `categories` (danh mục đồ dùng sinh viên)
  5. `user_preferences` (sở thích xem tin theo danh mục)
  6. `posts` (tin đăng bán SELL hoặc cần mua BUY_REQUEST)
  7. `sell_details` (chi tiết bán: giá, tình trạng, cho trả giá)
  8. `buy_request_details` (chi tiết cần mua: khoảng ngân sách)
  9. `post_images` (ảnh bài đăng, thứ tự sắp xếp)
  10. `conversations` (cuộc trò chuyện giữa buyer và seller)
  11. `messages` (tin nhắn dạng văn bản hoặc đính kèm)
  12. `attachments` (file đính kèm tin nhắn)
  13. `reputation_events` (sự kiện tích luỹ uy tín)
  14. `reports` (báo cáo vi phạm bài đăng)
  15. `audit_logs` (nhật ký kiểm toán hành vi quản trị/hệ thống)
  16. `phone_reveal_events` (sự kiện xin/xem số điện thoại liên hệ)
  17. `notifications` (thông báo người dùng)
  18. `system_configs` (tham số cấu hình hệ thống: điểm danh dự ban đầu, thời hạn OTP, v.v.)

---

## 2. Quy tắc nghiêm ngặt cho Database Agent

1. **Tuyệt đối KHÔNG tự ý chạy các câu lệnh phá hoại:**
   - CẤM chạy `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE`, hoặc `FLUSH`.
   - CẤM RESET database đang phát triển trên Supabase mà không có sự phê duyệt bằng văn bản từ Backend Lead / Tech Lead.
   - CẤM tạo lại 18 bảng đã có trên Supabase.

2. **Quy trình thay đổi Schema (Migration Workflow):**
   - Mọi thay đổi schema (thêm cột, thêm chỉ mục, sửa kiểu dữ liệu) PHẢI được viết thành file SQL migration có tiền tố số thứ tự và mốc thời gian rõ ràng trong thư mục `database/migrations/` (ví dụ: `database/migrations/0002_add_index_posts_created_at.sql`).
   - Mọi migration phải kèm câu lệnh rollback hoặc hướng dẫn hoàn tác an toàn (Zero Downtime / Backward Compatible).
   - Migration phải được tạo Pull Request và được Tech Lead review kỹ lưỡng trước khi áp dụng lên môi trường test/staging/production.

3. **Bảo mật và Quyền riêng tư:**
   - Dữ liệu mật khẩu (`password_hash`), mã OTP (`code_hash`), ảnh thẻ sinh viên (`card_image_ref`), khóa storage (`storage_key`) là thông tin tối mật.
   - Cấu hình Row Level Security (RLS) hoặc phân quyền truy cập cẩn thận trên Supabase; không để lộ connection string có chứa password trong git hoặc log.
   - Không xuất dữ liệu thật chứa PII (thông tin định danh cá nhân) ra các file seed hoặc tài liệu công khai.

4. **Seed dữ liệu mẫu (Development Seeds):**
   - Thư mục `database/seeds/` chỉ chứa dữ liệu danh mục tĩnh (`categories`), cấu hình hệ thống mặc định (`system_configs`), và dữ liệu test cục bộ giả lập đã được che giấu danh tính (anonymized).

---

## 3. Cách phối hợp khi có thay đổi

1. **Khi cần đổi database schema:**
   - Bước 1: Mở GitHub Issue mô tả lý do kỹ thuật và bảng/cột cần thay đổi.
   - Bước 2: Thảo luận ảnh hưởng đến API Contract (OpenAPI v1.2) và Backend Repository layer.
   - Bước 3: Tạo branch `feat/be-*` hoặc `chore/db-*`, viết migration file trong `database/migrations/`.
   - Bước 4: Cập nhật `tasks/AGENT_HANDOFF.md` và gửi Pull Request.
