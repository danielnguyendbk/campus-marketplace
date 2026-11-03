# Campus Marketplace - Authorization Matrix (Ma trận Phân quyền)

Tài liệu này đặc tả chi tiết ma trận kiểm soát truy cập (Access Control Matrix) cho toàn bộ tài nguyên và hoạt động API của Campus Marketplace v1.2, dựa trên **Vai trò người dùng (User Role)** và **Trạng thái xác minh (Verification Status)**.

---

## 1. Định nghĩa Vai trò và Trạng thái Tài khoản

Hệ thống phân tách rạch ròi giữa **Role** (Vai trò hệ thống) và **VerificationStatus** (Trạng thái thẩm định sinh viên):

### 1.1. Các Vai trò Hệ thống (`user_role` trong CSDL)
- **`GUEST` (Khách vãng lai):** Người dùng chưa đăng nhập, không có JWT token.
- **`USER`:** Người dùng đã đăng ký tài khoản thành công qua OTP email trường. Quyền hạn trong Marketplace phụ thuộc hoàn toàn vào `verification_status`.
- **`ADMIN`:** Quản trị viên hệ thống có toàn quyền thẩm định minh chứng sinh viên, xử lý báo cáo vi phạm, quản lý cấu hình và kiểm toán.

### 1.2. Các Trạng thái Xác minh Sinh viên (`verification_status` trong CSDL)
- **`PENDING`:** Đã xác thực OTP email trường, đã tạo mật khẩu nhưng chưa nộp minh chứng hoặc đang chờ Admin phê duyệt.
- **`REJECTED`:** Minh chứng sinh viên bị Admin từ chối do không hợp lệ (mờ, sai thông tin, thẻ hết hạn).
- **`APPROVED` (Verified Student):** Minh chứng sinh viên hợp lệ và đã được Admin phê duyệt. Được cấp quyền sử dụng đầy đủ các tính năng của sàn Campus Marketplace.
- **`SUSPENDED`:** Tài khoản bị khóa quyền hoạt động do vi phạm chính sách cộng đồng, bị nhiều báo cáo vi phạm hoặc nợ điểm uy tín.

---

## 2. Ma trận Phân quyền Chi tiết (Authorization Matrix)

**Ký hiệu quy ước:**
- ✅ **ALLOW:** Được phép truy cập đầy đủ.
- 🟡 **LIMITED:** Được phép truy cập ở chế độ giới hạn (chỉ xem thông tin rút gọn, không xem chi tiết/không tương tác).
- ❌ **DENY (401/403):** Bị chặn ở tầng Server-side (Trả về HTTP 401 Unauthorized nếu chưa đăng nhập, hoặc HTTP 403 Forbidden kèm mã lỗi nếu không đủ quyền).
- 👑 **ADMIN ONLY:** Chỉ tài khoản có vai trò `ADMIN` mới được phép thực thi.

| Nhóm chức năng | Endpoint | Phương thức | GUEST | PENDING | REJECTED | APPROVED | SUSPENDED | ADMIN | Ghi chú nghiệp vụ & Source |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Authentication** | `/auth/request-otp` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Gửi mã OTP xác thực email sinh viên đuôi `.edu.vn` (BR-02). |
| | `/auth/verify-otp` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Xác thực mã OTP để nhận `otpTicket`. |
| | `/auth/register` | `POST` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Đăng ký tài khoản kèm `otpTicket`, khởi tạo trạng thái `PENDING`. |
| | `/auth/login` | `POST` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Đăng nhập bằng email trường và mật khẩu. `SUSPENDED` bị chặn đăng nhập. |
| | `/auth/logout` | `POST` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Hủy phiên đăng nhập. |
| **Profile** | `/me` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Lấy hồ sơ cá nhân. Không trả `cardImageRef`, `passwordHash`. |
| | `/me` | `PATCH` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Cập nhật `displayName`, `phoneNumber`. |
| | `/me/evidences` | `GET` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | Xem lịch sử nộp minh chứng (chỉ cho PENDING/REJECTED; sau APPROVED ẩn theo BR-03). |
| | `/users/{id}` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Xem hồ sơ công khai của người dùng khác (chỉ trường public). |
| **Student Verification** | `/verifications` | `POST` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | Nộp thông tin sinh viên và tải lên ảnh thẻ sinh viên (`student_evidences`). |
| | `/verifications/my-status` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | Theo dõi trạng thái duyệt của bản thân. |
| **Admin Verification** | `/admin/verifications` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Hàng đợi danh sách hồ sơ sinh viên chờ duyệt. |
| | `/admin/verifications/{id}` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Chi tiết hồ sơ: Trả về **Signed URL** ngắn hạn để xem ảnh thẻ sinh viên. |
| | `/admin/verifications/{id}/approve` | `POST` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Phê duyệt hồ sơ $\rightarrow$ chuyển trạng thái thành `APPROVED`. |
| | `/admin/verifications/{id}/reject` | `POST` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Từ chối hồ sơ kèm lý do bắt buộc $\rightarrow$ chuyển thành `REJECTED`. |
| **Feed & Matching** | `/feed` | `GET` | ❌ | 🟡 | ❌ | ✅ | ❌ | ✅ | **PENDING nhận `PendingFeedPage` (không search, không detail)**; APPROVED nhận feed cá nhân hóa. |
| | `/posts/{id}/matches` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | Gợi ý ghép đôi 2 chiều giữa tin `SELL` và `BUY_REQUEST`. |
| **Categories** | `/categories` | `GET` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Lấy danh sách danh mục hàng hóa (công khai). |
| | `/categories/{id}` | `GET` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Chi tiết một danh mục hàng hóa. |
| **Posts & Search** | `/posts` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | **APPROVED ONLY:** Tìm kiếm, lọc và phân trang bài đăng. PENDING bị 403 Forbidden! |
| | `/posts/{id}` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | **APPROVED ONLY:** Xem chi tiết bài đăng. PENDING bị 403 Forbidden! |
| | `/posts` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | **APPROVED ONLY:** Đăng tin mới (`SELL` hoặc `BUY_REQUEST`). |
| | `/posts/{id}` | `PATCH` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Cập nhật thông tin bài đăng (chỉ chủ bài đăng hoặc Admin). |
| | `/posts/{id}/hide` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Tạm ẩn bài đăng (`ACTIVE` $\rightarrow$ `HIDDEN`). |
| | `/posts/{id}/unhide` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Bật lại hiển thị bài đăng (`HIDDEN` $\rightarrow$ `ACTIVE`). |
| | `/posts/{id}/sold` | `POST` | ❌ | ❌ | ❌ | ✅ (Seller) | ❌ | 👑 | Đánh dấu đã bán tin `SELL` (`ACTIVE` $\rightarrow$ `SOLD`). Terminal state. |
| | `/posts/{id}/close` | `POST` | ❌ | ❌ | ❌ | ✅ (Buyer) | ❌ | 👑 | Đóng tin tìm mua `BUY_REQUEST` (`ACTIVE` $\rightarrow$ `CLOSED`). Terminal state. |
| | `/posts/{id}/images` | `POST` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Tải thêm ảnh cho bài đăng (tối đa 5 ảnh). |
| | `/posts/{id}/images/{imgId}`| `DELETE` | ❌ | ❌ | ❌ | ✅ (Owner) | ❌ | 👑 | Xóa ảnh minh họa khỏi bài đăng. |
| **Contact Privacy** | `/posts/{id}/reveal-phone` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | **APPROVED ONLY:** Yêu cầu xem số điện thoại. Ghi nhận `phone_reveal_events`. |
| **Chat & Messaging** | `/conversations` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Danh sách cuộc trò chuyện mà người dùng là thành viên. |
| | `/conversations` | `POST` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Mở cuộc trò chuyện gắn với một bài đăng (`post_id`). |
| | `/conversations/{id}` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | Chi tiết cuộc trò chuyện và thông tin đối tác. |
| | `/conversations/{id}/messages` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | Xem lịch sử tin nhắn trong cuộc trò chuyện. |
| | `/conversations/{id}/messages` | `POST` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | ❌ | Gửi tin nhắn văn bản hoặc tệp đính kèm ($\le 10$MB). |
| | `/conversations/{id}/.../attachment-url` | `GET` | ❌ | ❌ | ❌ | ✅ (Member) | ❌ | 👑 | Lấy Signed URL tải tệp đính kèm (hết hạn sau 30 ngày). |
| | `/ws` (WebSocket) | `CONNECT` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Kết nối kênh thông báo và tin nhắn thời gian thực. |
| **Reports** | `/reports` | `POST` | ❌ | ❌ | ❌ | ✅ (Buyer) | ❌ | ❌ | Gửi báo cáo tin SELL (yêu cầu đã có hội thoại HOẶC đã xem số điện thoại). |
| | `/reports/my` | `GET` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Người mua theo dõi danh sách các báo cáo mình đã gửi. |
| | `/reports/about-me` | `GET` | ❌ | ❌ | ❌ | ✅ (Seller) | ❌ | ❌ | Người bán xem các báo cáo về tin của mình để phản hồi. |
| | `/reports/{id}/respond` | `POST` | ❌ | ❌ | ❌ | ✅ (Seller) | ❌ | ❌ | Người bán gửi phản hồi giải trình trước hạn chót. |
| | `/admin/reports` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Hàng đợi báo cáo chờ Admin xử lý. |
| | `/admin/reports/{id}` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Chi tiết báo cáo, kèm bối cảnh tin nhắn/bài đăng liên quan. |
| | `/admin/reports/{id}/resolve` | `POST` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Admin chấp thuận báo cáo $\rightarrow$ `RESOLVED`, trừ điểm uy tín người bán. |
| | `/admin/reports/{id}/dismiss` | `POST` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Admin bác bỏ báo cáo $\rightarrow$ `DISMISSED`. |
| **Notifications** | `/notifications` | `GET` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Danh sách thông báo cá nhân trong hệ thống. |
| | `/notifications/{id}/read` | `POST` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Đánh dấu thông báo đã đọc. |
| **Admin Management** | `/admin/users` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Danh sách và tìm kiếm người dùng hệ thống. |
| | `/admin/users/{id}/suspend` | `POST` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Khóa tài khoản người dùng vi phạm (`SUSPENDED`). |
| | `/admin/configs` | `GET` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Xem danh sách các tham số cấu hình hệ thống (`system_configs`). |
| | `/admin/configs/{key}` | `PATCH` | ❌ | ❌ | ❌ | ❌ | ❌ | 👑 | Cập nhật tham số cấu hình (điểm uy tín, hạn OTP, timeout). |
| **Infrastructure** | `/health` / `/api/v1/health` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Kiểm tra sức khỏe hệ thống và trạng thái kết nối PostgreSQL. |

---

## 3. Nguyên tắc Enforce ở Tầng Server-side

1. **Không phụ thuộc vào Client UI:**
   Frontend chỉ có trách nhiệm ẩn/hiển thị nút bấm để tối ưu trải nghiệm (UX). Toàn bộ quyền hạn phải được kiểm tra nghiêm ngặt tại Backend thông qua `AuthGuard`, `RoleGuard`, và `VerificationGuard`.
2. **Xử lý Mã lỗi HTTP chuẩn mực:**
   - Người dùng chưa đăng nhập gọi API cần xác thực: Trả về **`401 Unauthorized`**.
   - Tài khoản `PENDING`, `REJECTED`, hoặc `SUSPENDED` cố tình gọi API yêu cầu `APPROVED`: Trả về **`403 Forbidden`** với mã lỗi `ACCOUNT_NOT_VERIFIED` hoặc `ACCOUNT_SUSPENDED`.
   - Người dùng cố tình truy cập tài nguyên của người khác (bài đăng, hội thoại): Trả về **`403 Forbidden`** với mã lỗi `FORBIDDEN_RESOURCE`.
