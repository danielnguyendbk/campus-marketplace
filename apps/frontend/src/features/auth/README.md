# CMP-29 — Đăng ký OTP và đăng nhập

Truy vết: CMP-29 → CMP-6, FR-01, UI-01. FE đề xuất phân cỡ **M** (chờ PM chốt).

## Xem giao diện

Trong Terminal PowerShell của VS Code:

```powershell
cd D:\code\QLDAPM\campus-marketplace\apps\frontend
$env:NEXT_PUBLIC_AUTH_API_MODE='mock'
npm.cmd run dev -- -p 5173
```

Nếu server đang chạy, nhấn `Ctrl+C` trước khi đổi chế độ và chạy lại.

- Đăng ký: <http://localhost:5173/register>
- Đăng nhập: <http://localhost:5173/login>
- Trang chủ: <http://localhost:5173/> (cần đăng nhập).
- Hồ sơ xác thực: <http://localhost:5173/verification> (cần đăng nhập).

Mock chỉ bật khi `NEXT_PUBLIC_AUTH_API_MODE=mock`; giao diện luôn hiển thị nhãn mô phỏng. Mặc định là `live`. Với bản production, biến `NEXT_PUBLIC_*` được đóng vào bundle lúc build, cần build lại khi đổi chế độ.

## Thử luồng đăng ký và đăng nhập

1. Mở `/register`, nhập email trường dạng `tenban@ptit.edu.vn` rồi gửi mã. Chỉ dùng dữ liệu giả khi thử mock.
2. Thử OTP sai `000000`: giao diện báo lỗi và giữ nguyên bước OTP. Nhập `123456` để xác thực thành công.
3. Chỉ sau khi API trả `otpTicket` hợp lệ, giao diện mới mở tên hiển thị, mật khẩu và xác nhận mật khẩu. Mật khẩu cần ít nhất 8 ký tự, hai lần nhập phải khớp.
4. Tạo tài khoản thành công sẽ tự chuyển tới `/verification`, giữ trạng thái `PENDING`. Nhập thông tin sinh viên, chọn **ảnh giả** (tối đa 10 MB), nộp hồ sơ rồi chọn **Xem bảng tin giới hạn**. Mock không tải ảnh lên server, không lưu nội dung ảnh và không tự duyệt tài khoản.
5. Tài khoản mẫu có sẵn: `sinhvien@ptit.edu.vn` / `Campus123!`. Đăng nhập tài khoản này sẽ chuyển tới trang chủ, thấy thẻ tin rút gọn và các thao tác bị khóa. Đăng ký lại email này giúp thử lỗi email trùng. Có thể đăng xuất và đăng nhập bằng tài khoản mới tạo, miễn là chưa tải lại trang.
6. Thử gửi lại ngay sau khi yêu cầu OTP để xem lỗi giới hạn tần suất; chờ 30 giây rồi thử lại. OTP mô phỏng hết hạn sau 10 phút; ticket hết hạn sau 10 phút. Các giá trị này chỉ dành cho mô phỏng, không phải chính sách backend.

Mock không gửi email, không truy cập backend/database, không lưu tài khoản hoặc token vào browser storage. Dữ liệu và phiên đăng nhập chỉ ở bộ nhớ: dùng các liên kết trong ứng dụng để chuyển trang. Reload/mở tab mới cần đăng nhập lại; trong mock, tài khoản vừa tạo cũng được đặt lại. Khi hết `expiresIn` hoặc gặp HTTP 401, phiên bị xóa và chuyển tới đăng nhập. Mã OTP mẫu cố định nên không dùng để đánh giá việc phân biệt mã cũ/mới sau resend; adapter vẫn vô hiệu hóa ticket cũ khi cấp lại OTP.

## Quyền của tài khoản chờ duyệt

Theo hồ sơ nghiệp vụ v1.2 §2, §3.1, FR-04, BR-04, AT-03 và phụ lục Chốt 01:

- `PENDING`: đăng nhập, hoàn thiện/nộp hồ sơ, kiểm tra trạng thái và xem feed ACTIVE giới hạn. Không tìm kiếm/lọc, mở chi tiết, đăng tin, chat, xem số điện thoại, báo cáo hoặc kết nối WebSocket.
- `REJECTED`: chuyển tới hồ sơ để xem lý do và nộp lại; không tải bảng tin. Nộp lại thành công trở về `PENDING`.
- `APPROVED`: được vào trang chủ; trang hồ sơ ẩn các trường nộp và không trả ảnh minh chứng.
- `SUSPENDED`: bị từ chối đăng nhập; khi kiểm tra trạng thái phát hiện đình chỉ thì phiên bị xóa.

Trang chủ hiện là màn hình đích sau auth, dùng các trường tóm tắt có trong `PendingFeedItem`: id, tiêu đề, loại tin, thumbnail và ngày đăng. Không tự thêm giá, liên hệ hoặc link chi tiết cho `PENDING`. Các hình SVG khi không có thumbnail chỉ là minh họa thay thế, không phải ảnh thật của sản phẩm. Tìm kiếm, chi tiết, đăng tin, chat, Admin xét duyệt và Marketplace đầy đủ thuộc phần việc tiếp theo. Backend phải chặn quyền trên API/WebSocket; vô hiệu hóa nút ở FE không thay thế kiểm tra quyền phía server.

## Chuyển sang API thật (CMP-31)

```powershell
$env:NEXT_PUBLIC_AUTH_API_MODE='live'
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:3000/api/v1'
npm.cmd run dev -- -p 5173
```

Base URL trên dùng cho backend local mặc định; điều chỉnh theo môi trường được BE cung cấp. Khởi động lại server sau khi đổi biến.

HTTP đi qua `src/services/api.ts`, khớp `packages/api-contract/openapi.yaml`:

| Bước            | Endpoint POST       | Body                                   |
| --------------- | ------------------- | -------------------------------------- |
| Gửi/gửi lại OTP | `/auth/request-otp` | `{ email }`                            |
| Xác thực OTP    | `/auth/verify-otp`  | `{ email, code }`                      |
| Tạo tài khoản   | `/auth/register`    | `{ otpTicket, displayName, password }` |
| Đăng nhập       | `/auth/login`       | `{ email, password }`                  |

Phần nối sau auth dùng `GET /feed` (không query search/filter), `GET /me/verification` và `POST /me/evidence` dạng `FormData`. Gửi multipart không ép header JSON để trình duyệt tự tạo boundary. Các request này dùng cùng token và transport với đăng nhập, bao gồm mock. Feed dùng envelope phân trang `{ success: true, data: [...], meta, timestamp }`. API trạng thái chỉ giữ `status`, `reason`, `submittedAt`, không hiển thị lại ảnh/URL minh chứng.

Success envelope bắt buộc `{ success: true, data, timestamp }`; lỗi theo `{ error: { code, message, details? }, requestId? }`. Không fallback sang mock khi API thật lỗi. Adapter mock cũng đi qua kiểm tra envelope của API client.

Email đăng ký được kiểm tra sơ bộ định dạng `.edu.vn`; allowlist trường thực tế do backend quyết định. `expiresIn` từ API quyết định thời hạn ticket và session trên UI, backend vẫn là nơi xác thực cuối cùng. Register không gửi lại email, confirmation, role hoặc verificationStatus. Tài khoản mới phải nhận `USER/PENDING`; nộp hồ sơ không tự mở quyền đăng bài/chat. Duy trì phiên qua reload chưa triển khai; không bổ sung endpoint refresh/logout ngoài contract.

**Trạng thái tích hợp:** có đường gọi API thật cho auth, feed và hồ sơ; chưa xác nhận với backend/SMTP/storage thực tế. CMP-31 cần phối hợp BE kiểm tra allowlist, CORS, nội dung lỗi, rate limit, OTP email thật, multipart, thay đổi trạng thái và kiểm tra quyền server. UI-02/UI-03 trong thay đổi này là phần nối tối thiểu để luồng sau auth không bị cụt, chưa hoàn thành toàn bộ Marketplace. Không đánh dấu CMP-29 Done chỉ vì đã chuyển được trang: cần kiểm tra thủ công và PR được review/CI thông qua.

## Kiểm tra mã nguồn

Chỉ mở rộng hai file kiểm thử hiện có `src/test/App.test.tsx` và `src/test/api.test.ts`, không tạo file test mới.

Chạy tại `apps/frontend`:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test -- --no-cache
npm.cmd run build
```

Các lệnh của công cụ có thể tạo cache/build tiêu chuẩn trong thư mục đã gitignore. PR hướng về `develop`, theo template của repository; không commit `node_modules`, `.next`, cache hoặc `.env`.
