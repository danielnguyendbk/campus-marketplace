# Campus Marketplace - Authorization Matrix (Ma trận Phân quyền)

Tài liệu này đặc tả chi tiết ma trận kiểm soát truy cập (Access Control Matrix) cho toàn bộ tài nguyên và hoạt động API của Campus Marketplace v1.2, dựa trên **Vai trò người dùng (User Role)** và **Trạng thái xác minh (Verification Status)**.

---

## 1. Kiến trúc Kiểm soát Truy cập 3 Tầng (3-Tier Access Control Architecture)

Hệ thống phân định rạch ròi giữa **Trạng thái Xác thực (Authentication State)**, **Vai trò Nghiệp vụ (Business Role)** và **Trạng thái Thẩm định Sinh viên (Verification Status)**:

### 1.1. Trạng thái Xác thực (Authentication State — Tầng 1)
- **`UNAUTHENTICATED` (Khách vãng lai / Guest):** Trạng thái người dùng **chưa đăng nhập**, request không mang JWT Bearer Token hợp lệ.
  > [!IMPORTANT]
  > **Quy định Thống nhất về Khách vãng lai (Guest):**
  > - **Không phải vai trò nghiệp vụ:** "Guest" **tuyệt đối không phải là vai trò nghiệp vụ thứ ba** trong hệ thống hay trong CSDL (enum `user_role` trong PostgreSQL chỉ có `USER` và `ADMIN`). Guest đơn thuần là **trạng thái chưa xác thực (Unauthenticated State)**.
  > - **Chặn hoàn toàn Bảng tin (Feed):** Phù hợp với Hồ sơ nghiệp vụ v1.2 (nền tảng trao đổi đồ dùng nội bộ sinh viên), mọi request truy cập `GET /feed` khi chưa xác thực đều bị chặn ở tầng `JwtAuthGuard` với mã lỗi **HTTP 401 Unauthorized** (bắt buộc phải đăng nhập bằng email trường đại học để vào bảng tin).
  > - Khách vãng lai chỉ được phép gọi các public endpoints: yêu cầu/xác thực OTP (`/auth/request-otp`, `/auth/verify-otp`), đăng nhập/đăng ký (`/auth/login`, `/auth/register`), tra cứu danh mục (`/categories`) và kiểm tra sức khỏe hệ thống (`/health`).
- **`AUTHENTICATED` (Đã đăng nhập):** Request gửi kèm JWT Bearer Token hợp lệ, được `JwtAuthGuard` giải mã thành danh tính tài khoản hợp lệ trong hệ thống.

### 1.2. Vai trò Nghiệp vụ (`user_role` trong CSDL — Tầng 2)
Cơ sở dữ liệu PostgreSQL (`users.role`) và OpenAPI Contract chuẩn hóa định nghĩa **duy nhất 2 vai trò nghiệp vụ**:
- **`USER` (Sinh viên):** Sinh viên các trường đại học đã đăng ký tài khoản thành công qua email trường (`@*.edu.vn`). Quyền hạn cụ thể trong các luồng Marketplace được kiểm soát tiếp bởi tầng `VerificationGuard`.
- **`ADMIN` (Quản trị viên):** Ban quản trị nền tảng có toàn quyền thẩm định minh chứng thẻ sinh viên, xử lý báo cáo vi phạm, quản lý tài khoản người dùng, cấu hình tham số hệ thống và tra cứu kiểm toán (Audit Logs).

### 1.3. Trạng thái Xác minh Sinh viên (`verification_status` trong CSDL — Tầng 3)
Áp dụng đối với người dùng đã xác thực mang vai trò `USER`:
- **`PENDING`:** Đã xác thực OTP email trường, đã tạo mật khẩu nhưng đang chờ nộp minh chứng thẻ hoặc đang chờ Admin phê duyệt. Được cấp quyền xem bảng tin rút gọn `PendingFeedPage` (không link chi tiết bài đăng, không số điện thoại, không nhắn tin). Cố gắng thao tác sâu bị chặn **HTTP 403 Forbidden**.
- **`REJECTED`:** Minh chứng sinh viên bị Admin từ chối do không hợp lệ. Chỉ được phép xem trạng thái và nộp lại minh chứng qua `POST /me/evidence`.
- **`APPROVED` (Sinh viên chính thức đã duyệt thẻ):** Minh chứng sinh viên hợp lệ và đã được Admin phê duyệt. Được cấp toàn quyền sử dụng các tính năng giao dịch của Campus Marketplace (xem `PostPage`, xem SĐT qua `PhoneRevealEvent`, đăng tin SELL/BUY_REQUEST, mở hội thoại realtime, gửi báo cáo vi phạm).
- **`SUSPENDED`:** Tài khoản bị khóa quyền hoạt động do vi phạm chính sách cộng đồng hoặc nợ điểm uy tín ($reputation\_score < 1.0$). Bị chặn mọi hoạt động giao dịch.

---

## 2. Ma trận Phân quyền Chi tiết (Authorization Matrix)

**Ký hiệu quy ước:**
- ✅ **ALLOW:** Được phép truy cập đầy đủ.
- 🟡 **LIMITED:** Được phép truy cập ở chế độ giới hạn (chỉ xem thông tin rút gọn, không xem chi tiết/không tương tác).
- ❌ **DENY (401/403):** Bị chặn ở tầng Server-side (Trả về HTTP 401 Unauthorized nếu chưa đăng nhập / Unauthenticated, hoặc HTTP 403 Forbidden kèm mã lỗi nếu không đủ quyền).
- 👑 **ADMIN ONLY:** Chỉ tài khoản có vai trò `ADMIN` mới được phép thực thi.

| Nhóm chức năng | Endpoint | Phương thức | Chưa xác thực (Unauth/Guest) | USER (PENDING) | USER (REJECTED) | USER (APPROVED) | USER (SUSPENDED) | ADMIN | Ghi chú nghiệp vụ & Source |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Authentication** | `/auth/request-otp` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Gửi mã OTP xác thực email sinh viên đuôi `.edu.vn` (BR-02). |
| | `/auth/verify-otp` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Xác thực mã OTP để nhận `otpTicket`. |
| | `/auth/register` | `POST` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Đăng ký tài khoản kèm `otpTicket`, khởi tạo trạng thái `PENDING`. |
| | `/auth/login` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Đăng nhập bằng email trường và mật khẩu. `SUSPENDED` bị chặn đăng nhập. |
| | `/auth/logout` | `POST` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | [Chưa có trong OpenAPI v1.2 / Đề xuất mở rộng] Hủy phiên đăng nhập. |
| **Profile & Evidence** | `/me` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Lấy hồ sơ cá nhân. Không trả `cardImageRef`, `passwordHash`. |
| | `/me` | `PATCH` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Cập nhật `displayName`, `phoneNumber`. |
| | `/me/verification` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Lấy hồ sơ xác thực và danh sách minh chứng của tôi (OpenAPI chuẩn). |
| | `/me/evidence` | `POST` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | Nộp bổ sung / nộp lại minh chứng thẻ sinh viên (`student_evidences`). |
| | `/me/preferences` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Xem sở thích danh mục và từ khóa của tài khoản APPROVED. |
| | `/me/preferences` | `PATCH` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Cập nhật danh mục và từ khóa sở thích. |
| | `/users/{id}` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | [Chưa có trong OpenAPI v1.2 / Đề xuất mở rộng] Xem hồ sơ công khai của người bán. |
| **Admin Verification** | `/admin/verifications` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Hàng đợi danh sách hồ sơ sinh viên chờ duyệt. |
| | `/admin/verifications/{verificationId}` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Chi tiết hồ sơ: Trả về **Signed URL** ngắn hạn để xem ảnh thẻ sinh viên. |
| | `/admin/verifications/{verificationId}` | `PATCH` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Duyệt hồ sơ (`status: APPROVED`) hoặc Từ chối (`status: REJECTED`, kèm lý do). |
| **Feed & Matching** | `/feed` | `GET` | ❌ | 🟡 | ❌ | ✅ | ❌ | ✅ | **PENDING nhận `PendingFeedPage` (không search, không detail)**; APPROVED nhận feed cá nhân hóa. |
| | `/posts/{id}/matches` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Gợi ý ghép đôi 2 chiều giữa tin `SELL` và `BUY_REQUEST`. |
| **Categories** | `/categories` | `GET` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Lấy danh sách danh mục hàng hóa (công khai). |
| | `/categories/{id}` | `GET` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | [Chưa có endpoint chi tiết riêng trong OpenAPI v1.2; dùng `GET /categories`] |
| **Posts & Search** | `/posts` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | **APPROVED ONLY:** Tìm kiếm, lọc và phân trang bài đăng. PENDING bị 403 Forbidden! |
| | `/posts/{id}` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | **APPROVED ONLY:** Xem chi tiết bài đăng. PENDING bị 403 Forbidden! |
| | `/posts` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | **APPROVED ONLY:** Đăng tin mới (`SELL` hoặc `BUY_REQUEST`). |
| | `/posts/{id}` | `PATCH` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Cập nhật thông tin bài đăng (chỉ chủ bài đăng hoặc Admin). |
| | `/posts/{id}/hide` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Tạm ẩn bài đăng (`ACTIVE` $\rightarrow$ `HIDDEN`). |
| | `/posts/{id}/activate` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Bật lại hiển thị bài đăng (`HIDDEN` $\rightarrow$ `ACTIVE`). |
| | `/posts/{id}/sold` | `POST` | ❌ | ❌ | ❌ | ✅ (Seller) | ❌ | 👑 | Đánh dấu đã bán tin `SELL` (`ACTIVE` $\rightarrow$ `SOLD`). Terminal state. |
| | `/posts/{id}/close` | `POST` | ❌ | ❌ | ❌ | ✅ (Buyer) | ❌ | 👑 | Đóng tin tìm mua `BUY_REQUEST` (`ACTIVE` $\rightarrow$ `CLOSED`). Terminal state. |
| | `/posts/{id}/images` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Tải thêm ảnh cho bài đăng (tối đa 5 ảnh). |
| | `/posts/{id}/images/{imageId}` | `DELETE` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Xóa ảnh minh họa khỏi bài đăng. |
| **Contact Privacy** | `/posts/{id}/reveal-phone` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | **APPROVED ONLY:** Yêu cầu xem số điện thoại. Ghi nhận `phone_reveal_events`. |
| **Chat & Messaging** | `/conversations` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Danh sách cuộc trò chuyện mà người dùng là thành viên. |
| | `/conversations` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Mở cuộc trò chuyện gắn với một bài đăng (`post_id`). |
| | `/conversations/{conversationId}` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | [Chưa có endpoint chi tiết riêng trong OpenAPI v1.2; dùng `GET /conversations`] |
| | `/conversations/{conversationId}/messages` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | Xem lịch sử tin nhắn trong cuộc trò chuyện. |
| | `/conversations/{conversationId}/messages` | `POST` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | ❌ | Gửi tin nhắn văn bản. |
| | `/conversations/{conversationId}/attachments` | `POST` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | ❌ | Tải lên tệp đính kèm tin nhắn ($\le 10$MB). |
| | `/conversations/{conversationId}/attachments/{attachmentId}/download` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | Lấy Signed URL tải tệp đính kèm (hết hạn sau 30 ngày). |
| | `/ws` (WebSocket) | `CONNECT` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | [Giao thức WebSocket: wss://... /ws] Kênh thông báo và tin nhắn thời gian thực. |
| **Reports** | `/reports` | `POST` | ❌ | ❌ | ❌ | ✅ (Buyer) | ❌ | ❌ | Gửi báo cáo tin SELL (yêu cầu đã có hội thoại HOẶC đã xem số điện thoại). |
| | `/me/reports` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Người dùng xem danh sách báo cáo mình đã gửi hoặc nhận. |
| | `/reports/{reportId}` | `GET` | ❌ | ❌ | ❌ | ✅ (Party) | ❌ | 👑 | Xem chi tiết báo cáo và thời hạn phản hồi. |
| | `/reports/{reportId}/seller-response` | `POST` | ❌ | ❌ | ❌ | ✅ (Seller) | ❌ | ❌ | Người bán gửi phản hồi giải trình trước hạn chót (24h). |
| | `/admin/reports` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Hàng đợi báo cáo chờ Admin xử lý. |
| | `/admin/reports/{reportId}` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Chi tiết báo cáo, kèm bối cảnh tin nhắn/bài đăng liên quan. |
| | `/admin/reports/{reportId}` | `PATCH` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Admin xử lý báo cáo: duyệt (`RESOLVED`) hoặc bác bỏ (`DISMISSED`). |
| **Notifications** | `/me/notifications` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Danh sách thông báo cá nhân trong hệ thống. |
| | `/me/notifications/{id}/read` | `PATCH` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Đánh dấu thông báo đã đọc. |
| **Admin Management** | `/admin/users` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Danh sách và tìm kiếm người dùng hệ thống. |
| | `/admin/users/{userId}/status` | `PATCH` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Khóa tài khoản (`SUSPENDED`) hoặc mở khóa (`APPROVED`) kèm audit log. |
| | `/admin/reputation-events` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Xem lịch sử cộng/trừ điểm uy tín người bán. |
| | `/admin/audit-logs` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Tra cứu nhật ký kiểm toán hành động quản trị (BR-18). |
| | `/admin/configs` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Xem danh sách các tham số cấu hình hệ thống (`system_configs`). |
| | `/admin/configs/{configKey}` | `PATCH` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Cập nhật tham số cấu hình (chu kỳ trừ uy tín K, hạn OTP, timeout). |
| **Infrastructure** | `/health` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Kiểm tra sức khỏe hệ thống và trạng thái kết nối PostgreSQL. |

---

## 3. Nguyên tắc Enforce ở Tầng Server-side

1. **Không phụ thuộc vào Client UI:**
   Frontend chỉ có trách nhiệm ẩn/hiển thị nút bấm để tối ưu trải nghiệm (UX). Toàn bộ quyền hạn phải được kiểm tra nghiêm ngặt tại Backend thông qua `AuthGuard`, `RoleGuard`, và `VerificationGuard`.
2. **Xử lý Mã lỗi HTTP chuẩn mực:**
   - Người dùng chưa đăng nhập gọi API cần xác thực: Trả về **`401 Unauthorized`**.
   - Tài khoản `PENDING`, `REJECTED`, hoặc `SUSPENDED` cố tình gọi API yêu cầu `APPROVED`: Trả về **`403 Forbidden`** với mã lỗi `ACCOUNT_NOT_VERIFIED` hoặc `ACCOUNT_SUSPENDED`.
   - Người dùng cố tình truy cập tài nguyên của người khác (bài đăng, hội thoại): Trả về **`403 Forbidden`** với mã lỗi `FORBIDDEN_RESOURCE`.

