# Báo cáo thực thi CMP-30 — 15/11/2026

**Kết quả: chưa đủ điều kiện Done.** Các số sau đếm **43 ca thực thi con** độc lập sau khi tách theo hành vi/lớp: **Pass 35 · Fail 0 · Blocked 8 · Not Run 0**. Pass chỉ áp dụng cho kiểm tra nêu trong dòng, không mở rộng sang toàn bộ TC cha hoặc các phần chưa được kiểm chứng. Không tính báo cáo lịch sử hay test suite sẵn có vào kết quả này.

## Môi trường và phương pháp

- Commit code `00494ba316d37218bd2f903546141085b35f7739`, nhánh `feature/CMP-30-auth-bdd-testcase`; tài liệu CMP-30 và handoff là thay đổi chưa commit. Node 20.20.1, pnpm 10.14.0; PostgreSQL 17 local tạm trên 127.0.0.1:55432, database riêng, nạp baseline v1.2 và migration 0001 đã có; không dùng database Supabase hay dữ liệu thật. Backend Nest localhost:4100, frontend Next localhost:3100, live API.
- Cấu hình thử nghiệm chủ động: allowlist `edu.vn`, TTL 600 giây, ngưỡng sai 5, cooldown 1 giây, 20 lần/giờ; các giá trị này **không phải phê duyệt nghiệp vụ**. Domain con `test.edu.vn` và địa chỉ `cmp30-…` là dữ liệu hư cấu. Password/token/OTP/ticket được che, không lưu trong chứng cứ này.
- Mail console tạo OTP thật của backend và cho phép kiểm thử API–PostgreSQL trong môi trường local, nhưng **không gửi SMTP hoặc xác minh hộp thư trường**. Mỗi kiểm tra OTP dùng email riêng; EX-06A dùng fixture DB riêng để đưa hạn vào quá khứ; EX-17B cố ý dùng lại ticket. Các bước khởi tạo đầu tiên gặp lỗi tài khoản PostgreSQL local do cấu hình kết nối và đã sửa cấu hình, không tính là lỗi sản phẩm. Không can thiệp schema dự án hay code ứng dụng.
- Bằng chứng là quan sát HTTP/status/error code và số dòng user từ DB local được che tại bảng dưới; quan sát UI lấy từ trình duyệt trên frontend live. Không lưu OTP, token, mật khẩu hoặc log console chứa OTP. Đối chiếu cuối phiên: chỉ có một tài khoản test được tạo thành công, không có user cho các ca OTP sai/hết hạn/vượt ngưỡng. Dữ liệu và dịch vụ tạm được dừng sau phiên.

## Kết quả theo ca tách riêng

| ID thực thi | TC cha | Lớp | Kết quả | Bước chính | Quan sát / bằng chứng |
|---|---|---|---|---|---|
| EX-01A | TC-01 | API | Pass | POST request-otp với email test chưa tồn tại | 200; mã được ghi bởi mail console, user=0; không chứng minh SMTP |
| EX-01B | TC-01 | UI | Pass | Nhập email test hợp lệ và gửi | Chuyển sang bước OTP, hiển thị thông điệp trung tính |
| EX-01C | TC-01 | SMTP | Blocked | Kiểm tra hộp thư thực | Chưa có SMTP và hộp thư test được cấp phép |
| EX-02A | TC-02 | API | Pass | POST request-otp với domain ngoài danh sách test | 400 EMAIL_DOMAIN_NOT_ALLOWED |
| EX-02B | TC-02 | UI | Pass | Nhập email ngoài .edu.vn rồi gửi | UI báo yêu cầu dùng miền .edu.vn |
| EX-03A | TC-03 | API | Pass | POST request-otp email đã đăng ký | 200; thông điệp trung tính đúng contract; còn một user |
| EX-03B | TC-03 | API | Pass | POST register lại bằng ticket đã dùng cho email đã đăng ký | 409 EMAIL_ALREADY_REGISTERED; vẫn một user, không session mới |
| EX-04A | TC-04 | API | Pass | Verify OTP đúng còn hạn từ console test | 200 có ticket, không access token |
| EX-04B | TC-04 | UI | Pass | Yêu cầu mã test, lấy từ console và xác thực trên UI | Chuyển tới Hoàn tất tài khoản; [biên bản UI](evidence/UI_2026-11-15.md#ex-04b--pass) |
| EX-05A | TC-05 | API | Pass | Verify OTP sai với email có OTP hợp lệ | 400 OTP_INVALID, không ticket |
| EX-05B | TC-05 | UI | Pass | Nhập OTP sai tại bước OTP | UI báo mã không hợp lệ hoặc hết hạn và giữ bước OTP |
| EX-06A | TC-06 | API | Pass | Đặt expires_at của OTP test về quá khứ rồi verify mã đúng | 400 OTP_INVALID, không ticket; thử sau hạn, chưa thử đúng ranh giới |
| EX-07A | TC-07 | API | Pass | Với ngưỡng test=5, gửi mã sai 5 lần rồi gửi mã đúng | 4 lần 400, lần 5 trả 429; mã đúng sau ngưỡng cũng 429, không ticket; đây là cấu hình test |
| EX-08A | TC-08 | API | Pass | Gửi register thiếu ticket | 400 VALIDATION_FAILED, không session |
| EX-08B | TC-08 | API | Pass | Gửi register bằng ticket giả | 400 OTP_TICKET_INVALID, không session |
| EX-08C | TC-08 | UI | Pass | Mở đăng ký trước verify và sau OTP sai | Chỉ thấy bước email/OTP, không thấy trường tạo mật khẩu |
| EX-09A | TC-09 | API | Pass | Register ticket giả và login email test chưa có tài khoản | Register 400; login 401 INVALID_CREDENTIALS; không access token |
| EX-10A | TC-10 | API | Pass | Verify mã console rồi register bằng ticket | 201; user=USER/PENDING, 1 bản ghi email test; response có session |
| EX-10B | TC-10 | UI | Pass | OTP console → tạo mật khẩu → đăng ký trên UI | HTTP 201, response và DB USER/PENDING, chuyển /verification; [bằng chứng](evidence/ui-round3/README.md) |
| EX-11A | TC-11 | API | Pass | Login user PENDING bằng thông tin test đúng | 200; response USER/PENDING |
| EX-11B | TC-11 | UI | Pass | Login user PENDING test hợp lệ | Đi đến trang chủ, hiển thị tài khoản chờ xác thực |
| EX-12A | TC-12 | API | Pass | Login email tồn tại với mật khẩu sai | 401 INVALID_CREDENTIALS; không session |
| EX-12B | TC-12 | API | Pass | Login email chưa tồn tại | 401 INVALID_CREDENTIALS; không session |
| EX-12C | TC-12 | UI | Pass | Login email tồn tại với mật khẩu sai | UI báo email hoặc mật khẩu chưa đúng |
| EX-12D | TC-12 | UI | Pass | Login email chưa tồn tại trên UI | DB user=0; API 401 INVALID_CREDENTIALS; UI báo lỗi; [bằng chứng](evidence/ui-round3/README.md) |
| EX-13A | TC-13 | API | Pass | Đối chiếu role/status của session PENDING sau login | 200 USER/PENDING; chưa kiểm chứng tất cả role/status |
| EX-13B | TC-13 | API | Blocked | Gọi GET /feed với session PENDING | 404 NOT_FOUND; backend chưa có endpoint nên chưa kiểm quyền và nội dung feed |
| EX-13C | TC-13 | API | Blocked | Gọi GET /posts/{id} với session PENDING | 404 NOT_FOUND; endpoint và fixture bài ACTIVE chưa có, chưa kiểm quyền 403 |
| EX-13D | TC-13 | API | Blocked | Kiểm tra quyền APPROVED với bài ACTIVE | Thiếu endpoint và fixture APPROVED/bài ACTIVE |
| EX-13E | TC-13 | UI | Pass | Quan sát trang chủ sau login PENDING | Thẻ PENDING hiển thị; nút tìm kiếm/lọc/đăng tin/nhắn tin bị vô hiệu; feed báo lỗi |
| EX-14A | TC-14 | API | Blocked | Gọi GET /feed không token | 404 NOT_FOUND, không phải 401; endpoint chưa triển khai, không thể xác minh guard |
| EX-14B | TC-14 | UI | Blocked | Guest mở /verification | UI chuyển /login; backend feed và me/verification 404 nên chưa chứng minh bảo vệ server; [bằng chứng](evidence/ui-round3/README.md) |
| EX-15A | TC-15 | API | Pass | Gửi email trống | 400 VALIDATION_FAILED |
| EX-15D | TC-15 | API | Pass | Gửi email sai định dạng | 400 VALIDATION_FAILED |
| EX-15B | TC-15 | UI | Pass | Gửi form email trống | UI yêu cầu nhập email |
| EX-15C | TC-15 | UI | Pass | Nhập email sai định dạng và gửi | UI hiển thị “Email chưa đúng định dạng.” [Biên bản](evidence/UI_2026-11-15.md#ex-15c--pass) |
| EX-16A | TC-16 | API | Pass | Register với ticket hợp lệ và password 7 ký tự | 400 VALIDATION_FAILED, user=0 |
| EX-16B | TC-16 | UI | Pass | Verify OTP, nhập xác nhận khác rồi gửi | UI báo không khớp; 0 request register, DB user=0; [bằng chứng](evidence/ui-round3/README.md) |
| EX-17A | TC-17 | API | Pass | Verify lại OTP đã dùng | 400 OTP_INVALID, không ticket |
| EX-17B | TC-17 | API | Pass | Dùng lại ticket tuần tự sau đăng ký | 409 EMAIL_ALREADY_REGISTERED, một user; chưa chứng minh consume ticket độc lập hoặc race |
| EX-18A | TC-18 | API | Pass | Gửi OTP của email B cho email A | 400 OTP_INVALID, không ticket |
| EX-18B | TC-18 | API | Blocked | Gửi lại sau 1 giây và thử OTP cũ | Quan sát 200 rồi 400 OTP_INVALID; trạng thái lịch sử Blocked; nay có oracle cấu hình dự án, chưa chạy lại |
| EX-19A | TC-19 | API | Blocked | Thử mốc ngay trước/đúng/ngay sau hạn và các ngưỡng | Trạng thái lịch sử Blocked; nay đã mô tả mốc/đếm theo code, chưa chạy đủ biên |

## Sai khác / lỗi cần theo dõi

### DEF-CMP30-01 — Feed và chi tiết bài chưa có endpoint trong bản chạy

- **Phạm vi:** phụ thuộc tích hợp, đã được ghi nhận lịch sử tại `docs/qa/CMP-6-integration-checklist.md` mục O1; không tự gán là lỗi hồi quy auth hoặc kết luận guard không an toàn.
- **Bước:** chạy backend commit trên; đăng nhập PENDING bằng user test; gọi `GET /api/v1/feed` có token; gọi `GET /api/v1/posts/{id}`; gọi `/feed` không token; xem trang chủ UI PENDING.
- **Mong đợi khi tính năng đã triển khai:** PENDING được feed rút gọn, bị 403 detail với bài ACTIVE; guest bị 401 feed (contract `/feed`, `/posts/{id}`, D05).
- **Thực tế:** ba yêu cầu trả 404 `NOT_FOUND`; UI báo không thể hoàn thành yêu cầu tải feed. Chưa có fixture bài ACTIVE, nên EX-13C không chứng minh được kết quả phân quyền; EX-13B/C, 13D và 14A là **Blocked**, không phải Pass. Bằng chứng EX-13B/C/E và EX-14A. BE/PM xác nhận task và môi trường có triển khai chức năng rồi chạy lại.

Không phát hiện lỗi auth được xác nhận khác trong phạm vi các ca đã thực hiện. Các trường hợp chưa chạy hoặc chưa có oracle không được coi là đạt.

## Đối chiếu Q01–Q09 sau rà soát

Quy định cấu hình và kết luận Q01–Q09 hiện được duy trì tại [README](README.md#kết-quả-rà-soát-q01q09). Q01, Q02, Q06, Q09 đã được cụ thể hóa; các phần rõ của Q04, Q05, Q08 đã được ghi nhận. R01–R06 tiếp tục ghi sai khác hoặc phụ thuộc thực sự. `EX-18B` và `EX-19A` giữ Blocked theo kết quả phiên trước: mô tả oracle mới không phải là bằng chứng đã chạy lại. Kết quả 35 Pass / 8 Blocked không đổi.

## Phạm vi đã kiểm chứng và còn thiếu

API local đã thực thi nhánh OTP đúng/sai/hết hạn/sau ngưỡng, chặn ticket giả/thiếu, tạo PENDING, login đúng/sai và từ chối domain; UI đã kiểm tra email trống, sai domain, gửi OTP, OTP sai, login đúng/sai và hiển thị PENDING. Phiên tiếp theo đã kiểm UI verify đúng và email sai định dạng; [biên bản](evidence/UI_2026-11-15.md). Đã kiểm bổ sung UI đăng ký toàn bộ, login email chưa tồn tại và xác nhận mật khẩu. Chưa xác minh gửi thư thật, feed/detail guard, biên thời gian, chính sách resend và toàn bộ role/status. Không chạy lại lint/test suite/build vì đây là phiên thực thi ca thủ công/script, không sửa code ứng dụng.

DoD CMP-30 còn thiếu BE/FE thống nhất, có người xác nhận và tài liệu được chia sẻ/đính kèm Jira; các sai khác/phụ thuộc được ghi nhận để nhóm review; các ca Blocked không phải điều kiện mới do báo cáo tự đặt cho DoD gốc. Không tự thay đổi trạng thái Jira.

## Phiên UI tiếp theo — gián đoạn công cụ

Dựng lại môi trường local cùng commit và cấu hình thử nghiệm ở trên. EX-04B và EX-15C đã Pass bằng quan sát trực tiếp, có [biên bản đã che](evidence/UI_2026-11-15.md). EX-16B mới tới bước OTP; sau đó công cụ trình duyệt không còn khả dụng, nên EX-10B, 12D, 14B và 16B Blocked. Không có ảnh chụp trước gián đoạn. Cần khôi phục trình duyệt và dựng lại các dịch vụ local để tiếp tục. Không có SMTP thật trong phiên.

## Phiên Playwright tiếp theo — 15/11/2026

Công cụ CUA gọi `getState()` và khởi tạo tab đều trả `unsupported call: mcp__cua_repljs`. Theo phương án được yêu cầu, dùng Playwright đã có trong runtime với Chrome và dịch vụ local độc lập. EX-10B, EX-12D, EX-16B Pass; EX-14B quan sát được UI chuyển `/login` nhưng giữ Blocked vì chưa có endpoint bảo vệ để kiểm backend. Các ảnh đã che, kết quả HTTP/DB đã lọc và bước tái hiện ở [bằng chứng UI](evidence/ui-round3/README.md). Không kiểm SMTP thật. Ảnh EX-10B cho thấy trang hồ sơ báo lỗi vì endpoint chưa triển khai; đây là giới hạn tích hợp đã ghi trong DEF-CMP30-01, không làm mất kết quả đăng ký. Không có lỗi auth mới được xác nhận.
