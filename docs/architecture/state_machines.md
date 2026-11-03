# State Machines - Campus Marketplace v1.2

Tài liệu này mô tả chi tiết các State Machine (máy trạng thái) cốt lõi của hệ thống Campus Marketplace, đảm bảo tính nhất quán 100% với:
- Database schema: [schema_v1.2.sql](../../database/baseline/schema_v1.2.sql)
- Nghiệp vụ: [Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx](../../docs/business-rules/README.md)
- API Contract: [openapi.yaml](../../packages/api-contract/openapi.yaml)

---

## 1. Verification Status State Machine (`verification_status`)

Quản lý vòng đời xác minh danh tính sinh viên của tài khoản người dùng (`users.verification_status`).

### Các trạng thái:
- `PENDING`: Tài khoản mới đăng ký qua email trường (`.edu.vn`), đã nộp ảnh thẻ sinh viên, đang chờ Admin duyệt.
- `APPROVED`: Admin đã xác minh thẻ sinh viên hợp lệ. Tài khoản có đầy đủ quyền đăng bài, chat, xem chi tiết bài đăng và tìm mua.
- `REJECTED`: Admin từ chối thẻ sinh viên (ảnh mờ, sai thông tin, không chính chủ). Người dùng được phép upload lại thẻ mới để đưa về `PENDING`.
- `SUSPENDED`: Tài khoản bị tạm đình chỉ / khóa do điểm uy tín rớt xuống `<= 20` hoặc vi phạm chính sách nghiêm trọng.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Đăng ký & nộp thẻ SV (POST /auth/register)
    PENDING --> APPROVED: Admin duyệt thẻ hợp lệ (PATCH /admin/verifications/{id} - APPROVE)
    PENDING --> REJECTED: Admin từ chối thẻ (PATCH /admin/verifications/{id} - REJECT)
    REJECTED --> PENDING: Sinh viên nộp lại minh chứng mới (POST /auth/student-evidence)
    APPROVED --> SUSPENDED: Điểm uy tín <= 20 hoặc Admin cưỡng chế khóa
    SUSPENDED --> APPROVED: Admin mở khóa sau khi giải quyết khiếu nại
    APPROVED --> [*]
    SUSPENDED --> [*]
```

### Bảng chuyển trạng thái:
| Trạng thái hiện tại | Biến cố / Hành động | Tác nhân | Điều kiện / Ràng buộc | Trạng thái tiếp theo |
|---|---|---|---|---|
| `*` (Chưa có) | Đăng ký tài khoản | Khách vãng lai | Email `.edu.vn` hợp lệ, upload thẻ SV | `PENDING` |
| `PENDING` | Phê duyệt thẻ | Admin | Ảnh thẻ rõ nét, khớp MSSV và trường | `APPROVED` (cấp 100 điểm uy tín) |
| `PENDING` | Từ chối thẻ | Admin | Thẻ không hợp lệ kèm lý do | `REJECTED` |
| `REJECTED` | Nộp lại thẻ SV | Sinh viên | Upload minh chứng mới | `PENDING` |
| `APPROVED` | Phạt hạ uy tín / khóa | Hệ thống / Admin | Điểm uy tín `<= 20` hoặc cố tình vi phạm | `SUSPENDED` |
| `SUSPENDED` | Mở khóa tài khoản | Admin | Khiếu nại thành công | `APPROVED` |

---

## 2. Post Status State Machine (`post_status`)

Quản lý trạng thái bài đăng bán đồ cũ (`SELL`) và bài tìm mua (`BUY_REQUEST`).

### Các trạng thái:
- `ACTIVE`: Bài đăng đang hiển thị công khai trên bảng tin và kết quả tìm kiếm.
- `HIDDEN`: Bài đăng tạm ẩn (chủ bài đăng tự ẩn hoặc Hệ thống / Admin cưỡng chế ẩn do vi phạm/tố cáo).
- `SOLD`: Bài bán hàng đã giao dịch thành công (chỉ áp dụng bài `SELL`).
- `CLOSED`: Yêu cầu tìm mua đã hoàn tất hoặc đóng lại (áp dụng bài `BUY_REQUEST` hoặc chủ động đóng).

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Tạo bài đăng hợp lệ (POST /posts)
    ACTIVE --> HIDDEN: Chủ bài tự ẩn / Bị ẩn do vi phạm (PATCH /posts/{id}/status)
    HIDDEN --> ACTIVE: Chủ bài mở lại (nếu không bị Admin khóa)
    ACTIVE --> SOLD: Đã bán thành công (Bài SELL)
    ACTIVE --> CLOSED: Đã tìm được đồ / Đóng tin (Bài BUY_REQUEST)
    HIDDEN --> SOLD: Xác nhận bán khi đang ẩn
    HIDDEN --> CLOSED: Đóng tin khi đang ẩn
    SOLD --> [*]
    CLOSED --> [*]
```

### Bảng chuyển trạng thái:
| Trạng thái hiện tại | Biến cố / Hành động | Tác nhân | Điều kiện / Ràng buộc | Trạng thái tiếp theo |
|---|---|---|---|---|
| `*` | Đăng bài | Chủ bài đăng (APPROVED) | Đúng danh mục, giá và hình ảnh | `ACTIVE` |
| `ACTIVE` | Ẩn bài đăng | Chủ bài / Admin / Bot | Tự ẩn hoặc bị tố cáo quá hạn 24h | `HIDDEN` |
| `HIDDEN` | Bật lại hiển thị | Chủ bài đăng | Chỉ khi bài tự ẩn (không bị Admin cưỡng chế) | `ACTIVE` |
| `ACTIVE` / `HIDDEN` | Đánh dấu đã bán | Chủ bài đăng | Áp dụng loại bài `SELL` | `SOLD` |
| `ACTIVE` / `HIDDEN` | Đóng bài tìm mua | Chủ bài đăng | Áp dụng loại bài `BUY_REQUEST` | `CLOSED` |

---

## 3. Report Status State Machine (`report_status`)

Được thiết kế chính xác theo PostgreSQL enum v1.2:
`CREATE TYPE "report_status" AS ENUM ('SUBMITTED', 'WAITING_SELLER_RESPONSE', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'NO_RESPONSE');`

### Các trạng thái:
1. `SUBMITTED`: Tố cáo mới được người mua/người dùng gửi lên hệ thống.
2. `WAITING_SELLER_RESPONSE`: Áp dụng cho lý do `STALE_SOLD_POST` (hàng ảo, đã bán nhưng cố tình giữ bài để câu tương tác). Hệ thống tự động gửi cảnh báo và hẹn giờ 24h để người bán phản hồi.
3. `NO_RESPONSE`: Hết hạn 24h mà người bán không phản hồi. Hệ thống tự động chuyển sang `NO_RESPONSE`, ẩn bài đăng và trừ `-5` điểm uy tín.
4. `UNDER_REVIEW`: Admin đang trực tiếp thụ lý, điều tra và xác minh bằng chứng vi phạm.
5. `RESOLVED`: Admin đã xử lý xong và đưa ra quyết định xử phạt (ẩn bài, hạ uy tín, tạm khóa).
6. `DISMISSED`: Admin bác bỏ báo cáo do sai sự thật, vu khống hoặc không đủ bằng chứng.

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Người dùng gửi tố cáo (POST /reports)
    
    SUBMITTED --> WAITING_SELLER_RESPONSE: Lý do STALE_SOLD_POST (Kích hoạt đếm ngược 24h)
    SUBMITTED --> UNDER_REVIEW: Các lý do khác (Gian lận, hàng cấm, thông tin sai lệch)
    
    WAITING_SELLER_RESPONSE --> UNDER_REVIEW: Người bán gửi phản hồi/giải trình
    WAITING_SELLER_RESPONSE --> NO_RESPONSE: Hết hạn 24h không phản hồi (Auto ẩn bài, trừ 5 uy tín)
    
    NO_RESPONSE --> UNDER_REVIEW: Người bán khiếu nại quyết định tự động
    NO_RESPONSE --> RESOLVED: Khép lại hồ sơ xử phạt tự động
    
    UNDER_REVIEW --> RESOLVED: Admin xác định có vi phạm (Thực thi chế tài)
    UNDER_REVIEW --> DISMISSED: Admin bác bỏ tố cáo (Không đủ bằng chứng)
    
    RESOLVED --> [*]
    DISMISSED --> [*]
```

### Bảng chuyển trạng thái Report:
| Trạng thái hiện tại | Biến cố | Tác nhân | Điều kiện | Trạng thái tiếp theo |
|---|---|---|---|---|
| `*` | Gửi tố cáo | Người dùng đã duyệt (`APPROVED`) | Báo cáo bài đăng của người khác | `SUBMITTED` |
| `SUBMITTED` | Kích hoạt xác thực 24h | Hệ thống | `reason = STALE_SOLD_POST` | `WAITING_SELLER_RESPONSE` |
| `SUBMITTED` | Chuyển điều tra | Hệ thống / Admin | `reason != STALE_SOLD_POST` | `UNDER_REVIEW` |
| `WAITING_SELLER_RESPONSE` | Người bán giải trình | Người bán bị tố cáo | Trong thời hạn 24h | `UNDER_REVIEW` |
| `WAITING_SELLER_RESPONSE` | Hết hạn 24h | Hệ thống (Cron job) | Không nhận được phản hồi | `NO_RESPONSE` (ẩn bài, -5 uy tín) |
| `NO_RESPONSE` | Khiếu nại lại | Người bán | Cung cấp minh chứng bất khả kháng | `UNDER_REVIEW` |
| `NO_RESPONSE` | Đóng hồ sơ | Hệ thống | Quá hạn khiếu nại | `RESOLVED` |
| `UNDER_REVIEW` | Kết luận vi phạm | Admin | Bằng chứng xác đáng | `RESOLVED` (xử phạt tương ứng) |
| `UNDER_REVIEW` | Bác bỏ tố cáo | Admin | Tố cáo không có căn cứ | `DISMISSED` |

---

## 4. Conversation Status State Machine (`conversation_status`)

Quản lý trạng thái hộp thoại trò chuyện trực tiếp giữa người mua và người bán.

### Các trạng thái:
- `OPEN`: Cuộc trò chuyện đang mở, có thể gửi và nhận tin nhắn theo thời gian thực.
- `ARCHIVED`: Một hoặc hai bên đã đưa cuộc trò chuyện vào kho lưu trữ (ẩn khỏi danh sách hiển thị chính). Khi có tin nhắn mới, hội thoại tự động chuyển lại `OPEN`.

```mermaid
stateDiagram-v2
    [*] --> OPEN: Tạo hội thoại mới khi trao đổi bài đăng (POST /conversations)
    OPEN --> ARCHIVED: Người dùng lưu trữ hội thoại (PATCH /conversations/{id})
    ARCHIVED --> OPEN: Người dùng khôi phục hoặc nhận được tin nhắn mới
    OPEN --> [*]
```

---

## 5. Attachment Status State Machine (`attachment_status`)

Quản lý tệp đính kèm trong tin nhắn chat (ảnh đồ họa, hình chụp sản phẩm).

### Các trạng thái:
- `ACTIVE`: Tệp đã upload lên Object Storage thành công và đang khả dụng.
- `EXPIRED`: Tệp đã quá thời hạn lưu trữ tạm thời (theo chính sách dọn dẹp dung lượng).
- `DELETED`: Tệp đã được xóa khỏi Object Storage và đánh dấu xóa trong CSDL.

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Tải file đính kèm lên tin nhắn
    ACTIVE --> EXPIRED: Hết hạn lưu trữ (chính sách dọn dẹp lưu trữ định kỳ)
    EXPIRED --> DELETED: Hệ thống dọn dẹp xóa tệp vật lý
    ACTIVE --> DELETED: Người dùng xóa tin nhắn / thu hồi
    DELETED --> [*]
```

