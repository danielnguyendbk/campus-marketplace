# Campus Marketplace Business Rules v1.2

Source of Truth nghiệp vụ của dự án được lưu trữ tại file:
`D:\Documents\PTIT DOC\SPM\Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx`

---

## Tóm tắt các quy tắc nghiệp vụ trọng yếu

### 1. Tài khoản & Trạng thái Xác minh Sinh viên (Identity & Verification)
- **Đăng ký tài khoản:** Sinh viên bắt buộc xác thực qua mã OTP gửi về email trường đại học đuôi `.edu.vn` (BR-02).
- **Trạng thái tài khoản ban đầu (`PENDING`):**
  - Sau khi xác thực OTP và đặt mật khẩu, tài khoản ở trạng thái `PENDING`.
  - **Quyền hạn của `PENDING` (BR-04, FR-04):**
    - Được phép: Đăng nhập, xem và nộp lại hồ sơ minh chứng sinh viên, xem trạng thái phê duyệt cá nhân (`GET /me`, `GET /verifications/my-status`), và xem bảng tin `ACTIVE` ở chế độ giới hạn (`GET /feed` trả về `PendingFeedPage`).
    - **BỊ CHẶN HOÀN TOÀN:**
      - Tuyệt đối **KHÔNG** được tìm kiếm hay lọc tin (`GET /posts` yêu cầu `APPROVED`, trả về HTTP 403 Forbidden).
      - Tuyệt đối **KHÔNG** được xem chi tiết bài đăng (`GET /posts/{id}` yêu cầu `APPROVED`, trả về HTTP 403 Forbidden).
      - Tuyệt đối **KHÔNG** được đăng bài bán (`SELL`) hoặc tìm mua (`BUY_REQUEST`) (`POST /posts` yêu cầu `APPROVED`).
      - Tuyệt đối **KHÔNG** được chat realtime hoặc kết nối WebSocket (`/ws`, `/conversations`).
      - Tuyệt đối **KHÔNG** được yêu cầu xem số điện thoại (`POST /posts/{id}/reveal-phone`).
      - Tuyệt đối **KHÔNG** được gửi báo cáo vi phạm (`POST /reports`).
- **Bảo mật ảnh thẻ sinh viên (BR-03, T6R3, T9R4):**
  - Sinh viên tải lên ảnh thẻ sinh viên (`student_evidences.card_image_ref`) khi nộp hồ sơ.
  - Sau khi nộp, giao diện người dùng **ẩn hoàn toàn ảnh thẻ và chi tiết minh chứng** (kể cả chủ tài khoản sau khi được `APPROVED` cũng không được xem lại trên UI hay API profile thông thường; `GET /me` không trả về `cardImageRef`).
  - **CHỈ ADMIN** mới có quyền lấy Signed URL có thời hạn ngắn để xem ảnh thẻ sinh viên thông qua API kiểm duyệt (`GET /api/v1/admin/verifications/{id}`).
- **Xử lý duyệt minh chứng:**
  - Admin duyệt $\rightarrow$ Tài khoản chuyển sang `APPROVED` (Verified Student), được mở khóa toàn bộ tính năng Marketplace.
  - Admin từ chối $\rightarrow$ Chuyển sang `REJECTED` (bắt buộc kèm lý do từ chối). Sinh viên có thể cập nhật và nộp lại minh chứng để quay lại trạng thái `PENDING`.

---

### 2. Tin đăng & Vòng đời Bài đăng (Posts & Listings)
- **Loại tin đăng:**
  - `SELL`: Đăng bán đồ dùng cũ (yêu cầu giá `price > 0`, tình trạng hàng, tùy chọn thương lượng `is_negotiable`, ảnh minh họa).
  - `BUY_REQUEST`: Đăng tin cần mua đồ dùng học tập/sinh hoạt (yêu cầu khoảng ngân sách `budget_min >= 0`, `budget_max >= budget_min`).
- **Vòng đời trạng thái bài đăng (`post_status`):**
  - `ACTIVE`: Đang hiển thị công khai và cho phép tìm kiếm / ghép đôi matching.
  - `HIDDEN`: Tạm ẩn bởi người đăng hoặc bị Admin ẩn do vi phạm/nghi vấn. Người đăng có thể mở lại (`unhide`) từ `HIDDEN` về `ACTIVE`.
  - `SOLD`: Tin bán đã giao dịch thành công (chỉ áp dụng cho `SELL`).
  - `CLOSED`: Tin tìm mua đã đóng hoặc đã mua được (chỉ áp dụng cho `BUY_REQUEST`).
  - **Bất biến nghiệp vụ (Invariant):** Khi đã chuyển sang `SOLD` hoặc `CLOSED` thì là trạng thái kết thúc (terminal state), tuyệt đối không được chuyển ngược lại về `ACTIVE` hay `HIDDEN`.

---

### 3. Trao đổi, Tin nhắn & Bảo vệ Quyền riêng tư (Chat & Privacy)
- **Ràng buộc cuộc trò chuyện (`conversations`):** Mỗi cuộc trò chuyện luôn gắn chặt với một bài đăng (`post_id`) giữa người mua (`buyer_id`) và người bán (`seller_id`).
- **Bảo vệ số điện thoại:** Số điện thoại của người dùng được ẩn mặc định. Chỉ khi người mua thực sự có nhu cầu và nhấn xem số điện thoại trên bài đăng `SELL`, hệ thống mới ghi nhận sự kiện `phone_reveal_events` phía server.
- **Tệp đính kèm trong chat (`attachments`):** Giới hạn dung lượng tối đa 10MB/tệp, MIME allowlist nghiêm ngặt. Tệp đính kèm tự động hết hạn sau 30 ngày (`attachment_status = 'EXPIRED'`).

---

### 4. Báo cáo vi phạm & Máy trạng thái Báo cáo (Trust & Safety)
- **Điều kiện gửi báo cáo:** Chỉ người mua đã có cuộc hội thoại hợp lệ với người bán HOẶC đã phát sinh sự kiện xem số điện thoại (`phone_reveal_events`) gắn với tin đăng `SELL` mới có quyền gửi báo cáo (`POST /reports`). Hệ thống chống báo cáo trùng lặp qua index `(buyer_id, post_id, reason_code)`.
- **Máy trạng thái Báo cáo (`report_status` theo CSDL PostgreSQL v1.2):**
  1. `SUBMITTED`: Báo cáo vừa được người mua tạo thành công.
  2. `WAITING_SELLER_RESPONSE`: Báo cáo được chuyển đến người bán kèm thời hạn phản hồi (`response_deadline_at`). Đây là trạng thái mặc định của báo cáo trong CSDL.
  3. `UNDER_REVIEW`: Người bán đã gửi phản hồi hoặc hết hạn phản hồi, báo cáo chuyển sang hàng đợi để Admin thụ lý. (Trường hợp vi phạm nội dung nghiêm trọng/rõ ràng, Admin có thể kích hoạt xử lý sớm `is_early_reviewed = true` theo BR-14).
  4. `NO_RESPONSE`: Người bán không gửi phản hồi trước thời hạn; hệ thống tự động tăng bộ đếm `no_response_count` và chuyển xử lý.
  5. `RESOLVED`: Admin xác định báo cáo đúng $\rightarrow$ xử phạt người bán (trừ điểm uy tín -0.1 theo chu kỳ, có thể ẩn bài đăng hoặc khóa tài khoản `SUSPENDED`).
  6. `DISMISSED`: Admin bác bỏ báo cáo do không có căn cứ vi phạm.
- **Điểm uy tín (`reputation_score`):** Nằm trong đoạn $[0.0, 5.0]$, khởi tạo theo `system_configs`. Giao dịch an toàn tích lũy điểm; vi phạm báo cáo hoặc không phản hồi (`no_response_count`) sẽ bị trừ điểm uy tín.
