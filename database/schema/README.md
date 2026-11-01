# Database Schema Documentation (v1.2)

Dự án Campus Marketplace bao gồm **18 bảng** được phân loại theo các phân hệ nghiệp vụ chính:

## 1. Phân hệ Người dùng & Xác thực (Identity & Access)
- `users`: Tài khoản, thông tin sinh viên, email trường, số điện thoại, mật khẩu băm, vai trò (`USER`, `ADMIN`), trạng thái duyệt (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`), điểm uy tín.
- `otp_verifications`: Mã OTP (băm), mục đích (`REGISTER`), thời hạn hết hạn, số lần thử lại, trạng thái sử dụng.
- `student_evidences`: Minh chứng sinh viên (ảnh thẻ, giấy báo trúng tuyển...), lý do từ chối nếu không hợp lệ. Được bảo mật nghiêm ngặt.
- `user_preferences`: Tùy chọn danh mục ưu tiên theo dõi trên trang chủ của người dùng.

## 2. Phân hệ Tin đăng & Hàng hóa (Listings & Catalog)
- `categories`: Danh mục sản phẩm (sách, điện tử, đồ gia dụng...).
- `posts`: Bài đăng chung (loại: `SELL` hoặc `BUY_REQUEST`), tiêu đề, mô tả, danh mục, trạng thái (`ACTIVE`, `HIDDEN`, `SOLD`, `CLOSED`).
- `sell_details`: Chi tiết cho tin bán (giá tiền VND, tình trạng hàng cũ/mới, có chấp nhận thương lượng giá hay không).
- `buy_request_details`: Chi tiết cho tin tìm mua (khoảng giá mong muốn `budget_min`, `budget_max`).
- `post_images`: Ảnh minh họa bài đăng, có cờ `is_primary` và thứ tự hiển thị `display_order`.

## 3. Phân hệ Trao đổi & Tin nhắn (Communication)
- `conversations`: Cuộc trò chuyện gắn liền với một bài đăng (`post_id`) giữa người mua (`buyer_id`) và người bán (`seller_id`).
- `messages`: Từng tin nhắn gửi trong cuộc trò chuyện (văn bản hoặc đính kèm).
- `attachments`: Thông tin file/ảnh đính kèm trong tin nhắn, đường dẫn lưu trữ, trạng thái hết hạn.
- `phone_reveal_events`: Lưu vết khi một người dùng xem số điện thoại của người bán/người mua nhằm phòng ngừa gian lận.

## 4. Phân hệ Đánh giá, Giám sát & Quản trị (Trust, Safety & Governance)
- `reputation_events`: Lịch sử cộng/trừ điểm uy tín (hoàn tất giao dịch, bị báo cáo, xác thực thành công...).
- `reports`: Báo cáo bài đăng vi phạm (đã bán nhưng không gỡ, thông tin sai lệch, nội dung phản cảm...).
- `audit_logs`: Lịch sử các thao tác nhạy cảm của Admin hoặc hệ thống (duyệt thẻ sinh viên, ẩn bài đăng, khóa tài khoản).
- `notifications`: Thông báo trong ứng dụng gửi tới người dùng.
- `system_configs`: Cặp khóa/giá trị cho các cấu hình hệ thống thời gian thực (điểm thưởng ban đầu, timeout OTP, max images).
