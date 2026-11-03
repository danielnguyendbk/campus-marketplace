# API Implementation Status Matrix

Tài liệu này theo dõi trạng thái triển khai thực tế của toàn bộ 49 API operations trong OpenAPI Contract 3.x v1.2 (`packages/api-contract/openapi.yaml`) kèm endpoint giám sát hạ tầng `GET /health`.

---

## 1. Tổng quan phân loại

| Nhóm | Số lượng | Mô tả | Trạng thái hiện tại |
|---|---:|---|---|
| **Core API v1.2** | 35 | Các API cốt lõi quy định trong Hồ sơ nghiệp vụ v1.2 | Đã định nghĩa Contract (OpenAPI), nằm trong Backlog Sprint 1–3 |
| **Proposed Extensions** | 14 | Các API mở rộng bổ trợ cho UI flow, quản trị hệ thống và thông báo | Đã gắn tag `x-source: Proposed extension`, chờ duyệt chính thức |
| **Infrastructure / Health** | 1 | Endpoint kiểm tra sức khỏe hệ thống và kết nối DB Pooler (`GET /health`) | **Đã triển khai & Kiểm thử thành công** |
| **Tổng cộng** | **50** | | |

---

## 2. Chi tiết 35 Core API Operations (Hồ sơ v1.2)

| # | HTTP Method | Endpoint | Tag | Tên nghiệp vụ / Summary | Trạng thái triển khai | Backlog Ref |
|---|---|---|---|---|---|---|
| 1 | `POST` | `/auth/request-otp` | Authentication | Gửi mã OTP xác thực email trường | Contract Defined | `TASK-BE-AUTH-01` |
| 2 | `POST` | `/auth/verify-otp` | Authentication | Xác thực OTP & nhận token tạm | Contract Defined | `TASK-BE-AUTH-02` |
| 3 | `POST` | `/auth/register` | Authentication | Hoàn tất đăng ký & nộp thẻ SV | Contract Defined | `TASK-BE-AUTH-03` |
| 4 | `POST` | `/auth/login` | Authentication | Đăng nhập tài khoản sinh viên | Contract Defined | `TASK-BE-AUTH-04` |
| 5 | `GET` | `/me` | Profile | Lấy hồ sơ tài khoản hiện tại | Contract Defined | `TASK-BE-PROF-01` |
| 6 | `POST` | `/me/evidence` | Verification | Nộp lại ảnh thẻ sinh viên | Contract Defined | `TASK-BE-VERIF-01` |
| 7 | `GET` | `/me/verification` | Verification | Xem tiến trình duyệt thẻ SV | Contract Defined | `TASK-BE-VERIF-02` |
| 8 | `GET` | `/admin/verifications/{verificationId}` | Admin Verification | Chi tiết hồ sơ SV & signed URL thẻ | Contract Defined | `TASK-BE-ADMIN-01` |
| 9 | `PATCH` | `/admin/verifications/{verificationId}` | Admin Verification | Duyệt (APPROVE) hoặc từ chối (REJECT) | Contract Defined | `TASK-BE-ADMIN-02` |
| 10 | `GET` | `/me/preferences` | Preferences | Lấy cài đặt tìm kiếm/nhận tin | Contract Defined | `TASK-BE-PREF-01` |
| 11 | `PATCH` | `/me/preferences` | Preferences | Cập nhật bộ lọc trường, cơ sở | Contract Defined | `TASK-BE-PREF-02` |
| 12 | `GET` | `/posts` | Posts & Search | Tìm kiếm danh sách bài đăng bán/mua | Contract Defined | `TASK-BE-POST-01` |
| 13 | `POST` | `/posts` | Posts & Search | Đăng tin bán đồ cũ hoặc tìm mua | Contract Defined | `TASK-BE-POST-02` |
| 14 | `GET` | `/posts/{id}` | Posts & Search | Xem chi tiết bài đăng (chỉ APPROVED) | Contract Defined | `TASK-BE-POST-03` |
| 15 | `PATCH` | `/posts/{id}` | Posts & Search | Sửa nội dung, giá bán bài đăng | Contract Defined | `TASK-BE-POST-04` |
| 16 | `POST` | `/posts/{id}/hide` | Post Lifecycle | Chủ bài tự ẩn bài đăng | Contract Defined | `TASK-BE-POST-05` |
| 17 | `POST` | `/posts/{id}/sold` | Post Lifecycle | Đánh dấu bài đăng đã bán (bài SELL) | Contract Defined | `TASK-BE-POST-06` |
| 18 | `POST` | `/posts/{id}/close` | Post Lifecycle | Đóng tin tìm mua (bài BUY_REQUEST) | Contract Defined | `TASK-BE-POST-07` |
| 19 | `GET` | `/feed` | Feed & Matching | Bảng tin (PendingFeedPage / ApprovedFeed) | Contract Defined | `TASK-BE-FEED-01` |
| 20 | `GET` | `/posts/{id}/matches` | Feed & Matching | Gợi ý đồ dùng tương thích | Contract Defined | `TASK-BE-FEED-02` |
| 21 | `POST` | `/posts/{id}/reveal-phone` | Contact | Hiện SĐT người bán (ghi nhận event) | Contract Defined | `TASK-BE-CONT-01` |
| 22 | `POST` | `/conversations` | Conversations & Chat | Bắt đầu trò chuyện về bài đăng | Contract Defined | `TASK-BE-CHAT-01` |
| 23 | `GET` | `/conversations` | Conversations & Chat | Danh sách hội thoại của người dùng | Contract Defined | `TASK-BE-CHAT-02` |
| 24 | `GET` | `/conversations/{conversationId}/messages` | Conversations & Chat | Lịch sử tin nhắn trong hội thoại | Contract Defined | `TASK-BE-CHAT-03` |
| 25 | `POST` | `/conversations/{conversationId}/messages` | Conversations & Chat | Gửi tin nhắn văn bản | Contract Defined | `TASK-BE-CHAT-04` |
| 26 | `POST` | `/conversations/{conversationId}/attachments` | Conversations & Chat | Tải ảnh đính kèm trong tin nhắn | Contract Defined | `TASK-BE-CHAT-05` |
| 27 | `POST` | `/reports` | Reports & Reputation | Gửi tố cáo vi phạm bài đăng | Contract Defined | `TASK-BE-REP-01` |
| 28 | `GET` | `/me/reports` | Reports & Reputation | Lịch sử các báo cáo do mình gửi | Contract Defined | `TASK-BE-REP-02` |
| 29 | `POST` | `/reports/{reportId}/seller-response` | Reports & Reputation | Người bán giải trình trong 24h | Contract Defined | `TASK-BE-REP-03` |
| 30 | `PATCH` | `/admin/reports/{reportId}` | Admin Reports | Quyết định xử lý tố cáo (RESOLVED/DISMISSED) | Contract Defined | `TASK-BE-ADMREP-01` |
| 31 | `GET` | `/admin/users` | Admin Users & Audit | Danh sách người dùng hệ thống | Contract Defined | `TASK-BE-ADMUSR-01` |
| 32 | `PATCH` | `/admin/users/{userId}/status` | Admin Users & Audit | Khóa/Mở khóa tài khoản (SUSPENDED) | Contract Defined | `TASK-BE-ADMUSR-02` |
| 33 | `GET` | `/admin/audit-logs` | Admin Users & Audit | Xem nhật ký thao tác quản trị | Contract Defined | `TASK-BE-AUDIT-01` |
| 34 | `GET` | `/admin/reputation-events` | Admin Users & Audit | Lịch sử biến động điểm uy tín | Contract Defined | `TASK-BE-AUDIT-02` |
| 35 | `GET` | `/admin/reports/{reportId}` | Admin Reports | Chi tiết hồ sơ tố cáo kèm bằng chứng | Contract Defined | `TASK-BE-ADMREP-02` |

---

## 3. Chi tiết 14 Proposed Extensions

| # | HTTP Method | Endpoint | Tag | Mục đích đề xuất | Trạng thái phê duyệt |
|---|---|---|---|---|---|
| 1 | `PATCH` | `/me` | Profile | Cho phép cập nhật tên hiển thị, avatar | Chờ duyệt nhóm |
| 2 | `GET` | `/admin/verifications` | Admin Verification | Danh sách hồ sơ SV chờ duyệt phân trang | Chờ duyệt nhóm |
| 3 | `GET` | `/categories` | Categories | Lấy danh mục ngành hàng phục vụ form đăng tin | Chờ duyệt nhóm |
| 4 | `GET` | `/me/posts` | Posts & Search | Danh sách bài đăng do chính user quản lý | Chờ duyệt nhóm |
| 5 | `POST` | `/posts/{id}/activate` | Post Lifecycle | Kích hoạt lại bài viết sau khi tự ẩn (`HIDDEN` -> `ACTIVE`) | Chờ duyệt nhóm |
| 6 | `POST` | `/posts/{id}/images` | Posts & Search | Thêm ảnh vào bài đăng đã tạo | Chờ duyệt nhóm |
| 7 | `DELETE` | `/posts/{id}/images/{imageId}` | Posts & Search | Xóa bớt ảnh trong bài đăng | Chờ duyệt nhóm |
| 8 | `GET` | `/conversations/{conversationId}/attachments/{attachmentId}/download` | Conversations & Chat | Lấy Signed URL tải file đính kèm bảo mật | Chờ duyệt nhóm |
| 9 | `GET` | `/reports/{reportId}` | Reports & Reputation | Xem chi tiết báo cáo và phản hồi của người bán | Chờ duyệt nhóm |
| 10 | `GET` | `/admin/reports` | Admin Reports | Danh sách báo cáo vi phạm phân trang cho Admin | Chờ duyệt nhóm |
| 11 | `GET` | `/admin/configs` | Admin Users & Audit | Xem danh sách cấu hình hệ thống (điểm phạt, timeout) | Chờ duyệt nhóm |
| 12 | `PATCH` | `/admin/configs/{configKey}` | Admin Users & Audit | Điều chỉnh tham số hệ thống runtime | Chờ duyệt nhóm |
| 13 | `GET` | `/me/notifications` | Notifications | Danh sách thông báo (bị tố cáo, kết quả duyệt thẻ) | Chờ duyệt nhóm |
| 14 | `PATCH` | `/me/notifications/{id}/read` | Notifications | Đánh dấu đã đọc thông báo | Chờ duyệt nhóm |

---

## 4. Infrastructure & Internal Monitoring

| # | HTTP Method | Endpoint | Chức năng | Trạng thái triển khai |
|---|---|---|---|---|
| 1 | `GET` | `/health` | Kiểm tra trạng thái runtime của NestJS, uptime, latency kết nối PostgreSQL Supabase Pooler qua `rejectUnauthorized: true` TLS | **ĐÃ TRIỂN KHAI & PASS E2E TEST** |

