# Baseline Schema v1.2

Thư mục này chứa file SQL DDL gốc (`schema_v1.2.sql`) đại diện cho thiết kế CSDL v1.2 được xuất từ dbdiagram.io và đã được triển khai ban đầu lên Supabase.

## Quy tắc

- **TUYỆT ĐỐI KHÔNG SỬA ĐỔI** file `schema_v1.2.sql` này. Nó là mốc tham chiếu gốc (baseline reference).
- Bất kỳ thay đổi schema nào trong tương lai phải được đặt trong thư mục `database/migrations/` dưới dạng migration gia tăng.
- Baseline bao gồm 18 bảng:
  - `users`, `otp_verifications`, `student_evidences`, `categories`, `user_preferences`
  - `posts`, `sell_details`, `buy_request_details`, `post_images`
  - `conversations`, `messages`, `attachments`
  - `reputation_events`, `reports`, `audit_logs`, `phone_reveal_events`
  - `notifications`, `system_configs`
- Các kiểu ENUM tùy chỉnh:
  - `user_role`, `verification_status`, `otp_purpose`, `post_type`, `post_status`
  - `conversation_status`, `message_type`, `attachment_status`, `report_reason_code`
  - `reputation_action_type`, `notification_type`
