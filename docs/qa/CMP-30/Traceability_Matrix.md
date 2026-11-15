# Ma trận truy vết CMP-6 → CMP-30

Các mã `CMP6-AC-01`…`07` là mã nội bộ BA đặt cho các tiêu chí trong yêu cầu giao việc, không phải mã Jira hay mã hồ sơ. Nguồn FR/BR/AT xác minh tại hồ sơ v1.2 mục 4, 5, 10; AT-01 còn bao gồm nộp hồ sơ/ảnh ngoài phạm vi bộ auth này. Tag `@review` đánh dấu sai khác và `@dependency` đánh dấu phụ thuộc chưa triển khai; không thay đổi kết quả thực thi. “Thiết kế” không có nghĩa đã chạy hoặc đã review.

| AC nội bộ — giữ nguyên ý tiêu chí | FR/BR/AT đã xác minh | BDD → TC | Lớp | Mức bao phủ và thiếu |
|---|---|---|---|---|
| 01 Người dùng tạo tài khoản bằng thông tin đăng ký được yêu cầu | FR-01, BR-01/02, AT-01 | 01, 10, 15, 16 → TC-01, 10, 15, 16 | UI, API, tích hợp | Đã thực thi một phần; review R01–R03, AT-01 nộp hồ sơ/ảnh ngoài bộ auth |
| 02 Đăng nhập bằng thông tin hợp lệ | BR-01 là điều kiện phiên sau OTP | 11 → TC-11 | API, UI | PENDING đã chạy; các vai trò khác và endpoint quyền trong TC-13 |
| 03 Thông báo khi thông tin đăng nhập không hợp lệ | Không có liên kết FR-01/BR-01/02/AT-01 trực tiếp cho thông báo | 12 → TC-12 | API, UI | Đã chạy email không tồn tại và mật khẩu sai |
| 04 Sau đăng nhập xác định đúng trạng thái và quyền tài khoản | BR-04 và hồ sơ §2 hỗ trợ PENDING; không gán nhầm FR-01 | 11, 13 → TC-11, 13 | API, UI, tích hợp | PENDING/APPROVED đại diện; REJECTED/SUSPENDED và ADMIN cần fixture, quyết định quyền và bộ mở rộng nếu được giao; R02/R06 |
| 05 Người chưa đăng nhập không dùng chức năng yêu cầu xác thực | Hồ sơ §2; quyết định D05 | 14 → TC-14 | API, UI | Đại diện feed; phụ thuộc feed được triển khai R06 |
| 06 OTP email trường hợp lệ phải xác nhận trước password/phiên; email không trùng và domain allowlist | FR-01, BR-01, BR-02, AT-01 | 01–04, 08–10, 17 → TC-01–04, 08–10, 17 | API, UI, tích hợp | Đầy đủ các nhóm yêu cầu ở mức thiết kế; R01–R05 |
| 07 OTP sai, hết hạn hoặc vượt số lần thử bị backend từ chối | FR-01 và hồ sơ §3.1 | 05–07, 18–19 → TC-05–07, 18–19 | API/backend | Đủ ba nhóm; biên chưa chạy; cấu hình và oracle Q01 đã cụ thể hóa |

## Đối chiếu DoD CMP-30

| Yêu cầu | Bằng chứng / trạng thái |
|---|---|
| Email hợp lệ, sai domain, trùng | TC-01–03, cấu hình/thời điểm chặn đã cụ thể hóa; cần dữ liệu test phù hợp |
| OTP đúng, sai, hết hạn, vượt lần | TC-04–07, giá trị mặc định và quy tắc đã cụ thể hóa; biên chưa chạy |
| Chặn password trước OTP; chặn phiên | TC-08–09 gọi API trực tiếp |
| Đăng nhập đúng/sai, PENDING sau đăng ký | TC-10–12; quyền đại diện TC-13–14 |
| Liên kết FR-01, BR-01/02, AT-01 | Đã đối chiếu hồ sơ và ánh xạ ở bảng trên; AT-01 phần hồ sơ/ảnh chưa bao phủ |
| Thống nhất BE/FE và có người xác nhận | **Chưa có**; xem ô ký Jira_Handover.md |
| Lưu vào tài liệu nhóm hoặc Jira | File local trong repository; chưa chứng minh đã chia sẻ hoặc đính kèm Jira |

Mã BDD/TC trong bảng viết tắt `01` = `BDD-01`/`TC-01`. Kết quả thực thi từng phần và thiếu sót theo AC được cập nhật tại [Test_Execution_Report.md](Test_Execution_Report.md); các TC cha có thể chỉ đạt một số lớp.

## Thực thi theo AC

| AC | Kết quả thực thi / còn thiếu |
|---|---|
| 01 | EX-10A/B Pass tạo USER/PENDING trên API/UI; SMTP chưa kiểm, trang hồ sơ báo lỗi endpoint; EX-15C và 16B Pass UI validation. |
| 02 | EX-11A/B Pass PENDING; trạng thái khác chưa kiểm. |
| 03 | EX-12A/B/C/D Pass, gồm UI email chưa tồn tại. |
| 04 | EX-13A/E Pass trạng thái PENDING/UI; EX-13B/C/D Blocked do thiếu endpoint/fixture. |
| 05 | EX-14A Blocked vì feed 404; EX-14B UI chuyển login nhưng Blocked về bảo vệ server do endpoint chưa triển khai. |
| 06 | EX-01A/B, 02A/B, 03A/B, 04A/B, 08A/B/C, 09A, 10A Pass trong giới hạn local; UI auth đã kiểm; SMTP thật còn thiếu. |
| 07 | EX-05A/B, 06A, 07A Pass theo cấu hình test; mặc định và logic biên đã cụ thể hóa; kiểm thử biên chưa chạy. |
