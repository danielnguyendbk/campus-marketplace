# Campus Marketplace Business Rules v1.2

Source of Truth nghiệp vụ của dự án được lưu trữ tại file:
`D:\Documents\PTIT DOC\SPM\Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx`

## Tóm tắt các quy tắc nghiệp vụ trọng yếu

### 1. Tài khoản & Sinh viên (Users & Student Verification)
- Người dùng đăng ký bằng email sinh viên trường đại học (hỗ trợ mã OTP qua email).
- Khi mới đăng ký, tài khoản ở trạng thái `PENDING`.
- Để đăng tin bán (`SELL`) hoặc chat với người bán, người dùng cần gửi minh chứng sinh viên (`student_evidences`) và được Admin phê duyệt (`APPROVED`).
- Người dùng chưa duyệt có thể xem danh sách bài đăng và tìm kiếm.

### 2. Tin đăng (Posts & Listings)
- Có 2 loại tin: `SELL` (bán đồ cũ) và `BUY_REQUEST` (tìm mua đồ).
- Trạng thái tin đăng:
  - `ACTIVE`: Đang hiển thị và cho phép tìm kiếm.
  - `HIDDEN`: Bị ẩn bởi người dùng hoặc bị Admin ẩn do vi phạm.
  - `SOLD`: Đã bán thành công.
  - `CLOSED`: Tin tìm mua đã đóng hoặc hết hạn.
- Đơn vị giá niêm yết: VND. Tin bán có thể chấp nhận thương lượng giá (`is_negotiable`).

### 3. Trao đổi & Tin nhắn (Chat & Privacy)
- Cuộc trò chuyện (`conversations`) luôn gắn liền với một bài đăng (`post_id`).
- Số điện thoại của người bán/người mua được bảo vệ mặc định. Nếu một bên muốn xem số điện thoại, hệ thống sẽ ghi nhận sự kiện `phone_reveal_events` để kiểm soát hành vi và phòng chống lừa đảo.

### 4. Báo cáo & Điểm uy tín (Trust & Safety)
- Người dùng có điểm uy tín (`reputation_score`), ban đầu khởi tạo theo cấu hình `system_configs`.
- Hành vi hoàn tất giao dịch an toàn giúp tăng điểm.
- Bị báo cáo xác thực (`reports`) vi phạm có thể bị trừ điểm uy tín hoặc khóa tài khoản (`SUSPENDED`).
