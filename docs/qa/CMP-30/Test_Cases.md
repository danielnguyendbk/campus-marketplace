# Test case CMP-6 — đăng ký OTP và đăng nhập

Kết quả thực thi được tách theo hành vi và lớp trong [báo cáo](Test_Execution_Report.md); trạng thái TC cha là tổng hợp bảo thủ. Các ca 01–14 bắt buộc; 15–19 đề xuất bổ sung. Quy ước, mặc định cấu hình và kết quả rà soát Q01–Q09 ở [README](README.md); R01–R06 là sai khác/phụ thuộc, không làm thay đổi kết quả đã chạy. Mỗi ca độc lập, chạy trong môi trường test; các giá trị giữa dấu `<...>` là placeholder. Bằng chứng phải che thông tin nhạy cảm.

| TC | Mục tiêu | BDD | Ưu tiên | Lớp | Sẵn sàng |
|---|---|---|---|---|---|
| TC-01 | Email hợp lệ, được phép, chưa tồn tại | BDD-01 | P0 | UI + API/backend | Cần hộp thư test/console; review R01 |
| TC-02 | Email ngoài allowlist | BDD-02 | P0 | API/backend + UI | Sẵn sàng với cấu hình test; review domain gốc R05 |
| TC-03 | Email đã tồn tại | BDD-03 | P0 | API/backend | Cần fixture ticket của email đã có |
| TC-04 | OTP đúng còn hiệu lực | BDD-04 | P0 | API/backend + UI | Sẵn sàng với OTP test và TTL môi trường |
| TC-05 | OTP sai | BDD-05 | P0 | API/backend | Sẵn sàng với OTP test |
| TC-06 | OTP hết hạn | BDD-06 | P0 | API/backend | Cần đồng hồ hoặc fixture test để vượt TTL |
| TC-07 | Vượt số lần nhập sai | BDD-07 | P0 | API/backend | Sẵn sàng với MAX_OTP_ATTEMPTS của môi trường |
| TC-08 | Bỏ qua UI để tạo mật khẩu trước OTP | BDD-08 | P0 | API/backend + UI | Sẵn sàng với môi trường test |
| TC-09 | Không có phiên đăng ký khi chưa verify | BDD-09 | P0 | API/backend | Sẵn sàng với môi trường test |
| TC-10 | Đăng ký thành công và PENDING | BDD-10 | P0 | Tích hợp UI + API/backend | Sẵn sàng cho auth; review R01/R02 |
| TC-11 | Đăng nhập thông tin hợp lệ | BDD-11 | P0 | API/backend + UI | Sẵn sàng với user test PENDING |
| TC-12 | Đăng nhập thông tin không hợp lệ | BDD-12 | P0 | API/backend + UI | Sẵn sàng với fixture login test |
| TC-13 | Trạng thái và quyền sau đăng nhập | BDD-13 | P0 | Tích hợp API/backend + UI | Blocked: endpoint/fixture feed/detail chưa triển khai (R06) |
| TC-14 | Khách truy cập chức năng yêu cầu xác thực | BDD-14 | P0 | API/backend + UI | Blocked: endpoint bảo vệ chưa triển khai (R06) |
| TC-15 | Email trống hoặc sai định dạng | BDD-15 | P1 | API/backend + UI | Sẵn sàng với môi trường test |
| TC-16 | Mật khẩu không hợp lệ và xác nhận không khớp | BDD-16 | P1 | API/backend + UI | Sẵn sàng; review R03 về BE/contract |
| TC-17 | Dùng lại OTP hoặc ticket | BDD-17 | P1 | API/backend | Sẵn sàng cho kiểm thử tuần tự; review R04 về tiêu thụ ticket |
| TC-18 | Gửi lại và OTP thuộc email khác | BDD-18 | P1 | API/backend | Sẵn sàng chạy lại theo cấu hình resend và fixture |
| TC-19 | Biên thời gian và số lần thử OTP | BDD-19 | P1 | API/backend | Cần đồng hồ test/fixture để chạy các mốc biên |

## TC-01 — Email hợp lệ, được phép, chưa tồn tại

- **Mục tiêu:** Xác minh email hợp lệ, được phép, chưa tồn tại.
- **Truy vết:** CMP6-AC-01; BDD-01; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / UI + API/backend.
- **Tiền điều kiện:** E_NEW chưa tồn tại; hộp thư test hoạt động; D_ALLOW có trong cấu hình môi trường test.
- **Dữ liệu:** E_NEW.

**Bước thực hiện**

1. Mở đăng ký và nhập E_NEW.
2. Gửi yêu cầu OTP; gọi trực tiếp POST /auth/request-otp với E_NEW trên lượt thử độc lập.
3. Kiểm tra hộp thư test.

**Kết quả mong đợi:** Yêu cầu được chấp nhận; phản hồi trung tính, có OTP gửi tới hộp thư test; chưa tạo user/session. Hồ sơ nêu nhập tên trước OTP, UI hiện nhập sau OTP: review R01.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Cần hộp thư test/console; review R01.
- **Kết quả thực tế / trạng thái TC cha:** Blocked; từng phần: EX-01A, EX-01B, EX-01C. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-02 — Email ngoài allowlist

- **Mục tiêu:** Xác minh email ngoài allowlist.
- **Truy vết:** CMP6-AC-06; BDD-02; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** D_DENY được xác nhận nằm ngoài allowlist.
- **Dữ liệu:** cmp30-out@<D_DENY>.

**Bước thực hiện**

1. Nhập email trên UI và yêu cầu OTP.
2. Gọi POST /auth/request-otp trực tiếp với email đó.
3. Kiểm tra không có account/session được tạo.

**Kết quả mong đợi:** BE từ chối 400; không phát OTP hợp lệ cho email đó, không tạo account/session; UI thông báo không hợp lệ. Mã BE hiện tại EMAIL_DOMAIN_NOT_ALLOWED; UI thông báo domain không hợp lệ.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với cấu hình test; review domain gốc R05.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-02A, EX-02B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-03 — Email đã tồn tại

- **Mục tiêu:** Xác minh email đã tồn tại.
- **Truy vết:** CMP6-AC-06; BDD-03; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend.
- **Tiền điều kiện:** E_EXIST đã có user; quyền kiểm tra số user.
- **Dữ liệu:** E_EXIST; ticket hợp lệ từ fixture dành cho E_EXIST nếu BE hỗ trợ.

**Bước thực hiện**

1. POST /auth/request-otp cho E_EXIST.
2. Kiểm tra không tạo account thứ hai; xác nhận thông điệp trung tính.
3. Dùng fixture ticket đã verify hợp lệ của E_EXIST POST /auth/register.

**Kết quả mong đợi:** Bước 1 trả 200 trung tính không tiết lộ tồn tại; bước 3 bị từ chối trùng, không tạo user thứ hai hoặc session. Contract có 409; BE hiện trả EMAIL_ALREADY_REGISTERED.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Cần fixture ticket của email đã có.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-03A, EX-03B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-04 — OTP đúng còn hiệu lực

- **Mục tiêu:** Xác minh otp đúng còn hiệu lực.
- **Truy vết:** CMP6-AC-06; BDD-04; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** E_NEW đã yêu cầu OTP; chưa quá hạn/chưa vượt ngưỡng.
- **Dữ liệu:** E_NEW, OTP_OK từ hộp thư test.

**Bước thực hiện**

1. POST /auth/verify-otp với E_NEW và OTP_OK.
2. Kiểm tra response; lặp trên UI với OTP riêng.

**Kết quả mong đợi:** 200 trả otpTicket và expiresIn; UI cho phép bước mật khẩu. Chưa tạo user hoặc access session ở bước verify.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với OTP test và TTL môi trường.
- **Kết quả thực tế / trạng thái TC cha:** Pass; EX-04A và EX-04B đã chạy, SMTP thật vẫn chưa kiểm; từng phần: EX-04A, EX-04B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-05 — OTP sai

- **Mục tiêu:** Xác minh otp sai.
- **Truy vết:** CMP6-AC-07; BDD-05; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend.
- **Tiền điều kiện:** E_NEW có OTP còn hiệu lực, số lần sai dưới ngưỡng.
- **Dữ liệu:** E_NEW, OTP_BAD.

**Bước thực hiện**

1. POST /auth/verify-otp với E_NEW và OTP_BAD.
2. Thử register không có ticket hợp lệ.

**Kết quả mong đợi:** Verify bị từ chối, không trả ticket; register bị từ chối, không tạo user/session. BE trả 400 OTP_INVALID khi chưa chạm ngưỡng; mặc định 4 lần đầu.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với OTP test.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-05A, EX-05B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-06 — OTP hết hạn

- **Mục tiêu:** Xác minh otp hết hạn.
- **Truy vết:** CMP6-AC-07; BDD-06; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend.
- **Tiền điều kiện:** E_NEW có OTP_OK; fixture đồng hồ hoặc dữ liệu test đưa thời điểm qua OTP_TTL.
- **Dữ liệu:** E_NEW, OTP_OK đã hết hạn.

**Bước thực hiện**

1. Đưa thời gian qua hạn theo quy tắc đã chốt.
2. POST /auth/verify-otp.
3. Kiểm tra không có ticket, user hoặc session.

**Kết quả mong đợi:** Verify bị backend từ chối; không tạo ticket/session. BE hiện trả 400 OTP_INVALID.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Cần đồng hồ hoặc fixture test để vượt TTL.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-06A. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-07 — Vượt số lần nhập sai

- **Mục tiêu:** Xác minh vượt số lần nhập sai.
- **Truy vết:** CMP6-AC-07; BDD-07; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend.
- **Tiền điều kiện:** E_NEW có OTP còn hiệu lực, bộ đếm mới; MAX_OTP_ATTEMPTS đã chốt.
- **Dữ liệu:** E_NEW, OTP_BAD, OTP_OK.

**Bước thực hiện**

1. Gửi OTP_BAD đủ số lần theo chính sách đã xác nhận.
2. Sau khi vượt ngưỡng, POST verify với OTP_OK.
3. Kiểm tra không có ticket, user/session.

**Kết quả mong đợi:** Sau vượt ngưỡng OTP đúng cũng bị từ chối, không ticket hoặc session. BE trả 429 OTP_ATTEMPTS_EXCEEDED từ lần sai chạm ngưỡng: lần 5 nếu dùng cấu hình mặc định; sau đó mã đúng cũng bị từ chối.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với MAX_OTP_ATTEMPTS của môi trường.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-07A. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-08 — Bỏ qua UI để tạo mật khẩu trước OTP

- **Mục tiêu:** Xác minh bỏ qua ui để tạo mật khẩu trước otp.
- **Truy vết:** CMP6-AC-06; BDD-08; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** E_NEW chưa verify OTP.
- **Dữ liệu:** displayName="Sinh viên Test", PASSWORD_VALID; otpTicket thiếu hoặc giả.

**Bước thực hiện**

1. Trên UI kiểm tra bước đặt mật khẩu trước verify.
2. POST /auth/register trực tiếp với ticket thiếu; lặp bằng ticket giả.
3. Kiểm tra user/session.

**Kết quả mong đợi:** UI không mở bước mật khẩu; cả hai lời gọi bị từ chối; không có user/password hay access session. BE hiện trả 400 cho ticket giả; lỗi thiếu theo validation.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với môi trường test.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-08A, EX-08B, EX-08C. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-09 — Không có phiên đăng ký khi chưa verify

- **Mục tiêu:** Xác minh không có phiên đăng ký khi chưa verify.
- **Truy vết:** CMP6-AC-06; BDD-09; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend.
- **Tiền điều kiện:** E_NEW chưa verify, chưa có user.
- **Dữ liệu:** E_NEW, PASSWORD_VALID; ticket giả.

**Bước thực hiện**

1. POST /auth/register với ticket giả và dữ liệu hợp lệ.
2. POST /auth/login với E_NEW và PASSWORD_VALID.
3. Kiểm tra các response và số user.

**Kết quả mong đợi:** Register và login bị từ chối; không cấp accessToken hay tạo user. Login 401 cho thông tin không hợp lệ theo contract.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với môi trường test.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-09A. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-10 — Đăng ký thành công và PENDING

- **Mục tiêu:** Xác minh đăng ký thành công và pending.
- **Truy vết:** CMP6-AC-01; BDD-10; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / Tích hợp UI + API/backend.
- **Tiền điều kiện:** E_NEW chưa có user; OTP được xác thực và ticket còn hạn.
- **Dữ liệu:** E_NEW, OTP_OK, displayName="Sinh viên Test", PASSWORD_VALID.

**Bước thực hiện**

1. Hoàn tất request và verify OTP.
2. POST /auth/register với ticket, displayName, password; kiểm tra response và user test.
3. Lặp luồng UI với email test khác.

**Kết quả mong đợi:** Register 201, tạo một user PENDING, email từ ticket, session thuộc user đó; UI dẫn tới hồ sơ theo luồng v1.2. Chưa coi nộp hồ sơ/ảnh là đã kiểm.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng cho auth; review R01/R02.
- **Kết quả thực tế / trạng thái TC cha:** Pass cho auth; EX-10A/B Pass, UI /verification báo lỗi tải hồ sơ do endpoint chưa triển khai; SMTP thật chưa kiểm; từng phần: EX-10A, EX-10B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-11 — Đăng nhập thông tin hợp lệ

- **Mục tiêu:** Xác minh đăng nhập thông tin hợp lệ.
- **Truy vết:** CMP6-AC-02; BDD-11; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** User test PENDING đã đăng ký và biết mật khẩu.
- **Dữ liệu:** E_EXIST, PASSWORD_VALID.

**Bước thực hiện**

1. POST /auth/login với thông tin hợp lệ.
2. Kiểm tra response; đăng nhập UI bằng tài khoản test.

**Kết quả mong đợi:** 200 trả session, đúng user và PENDING; UI thể hiện trạng thái phù hợp. Không yêu cầu APPROVED mới được login.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với user test PENDING.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-11A, EX-11B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-12 — Đăng nhập thông tin không hợp lệ

- **Mục tiêu:** Xác minh đăng nhập thông tin không hợp lệ.
- **Truy vết:** CMP6-AC-03; BDD-12; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** User test tồn tại; email test khác chưa tồn tại.
- **Dữ liệu:** E_EXIST + mật khẩu sai; email chưa tồn tại + mật khẩu bất kỳ.

**Bước thực hiện**

1. POST /auth/login từng bộ dữ liệu.
2. Lặp trên UI, quan sát thông báo.

**Kết quả mong đợi:** Cả hai bị từ chối, không có session; contract 401; BE hiện INVALID_CREDENTIALS và cùng thông điệp. UI báo thông tin không hợp lệ; response BE có cùng code và thông điệp.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với fixture login test.
- **Kết quả thực tế / trạng thái TC cha:** Pass; EX-12A/B/C/D Pass; từng phần: EX-12A, EX-12B, EX-12C, EX-12D. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-13 — Trạng thái và quyền sau đăng nhập

- **Mục tiêu:** Xác minh trạng thái và quyền sau đăng nhập.
- **Truy vết:** CMP6-AC-04; BDD-13; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / Tích hợp API/backend + UI.
- **Tiền điều kiện:** Có user test PENDING và APPROVED, trạng thái/role được thiết lập có kiểm soát; feed/post API sẵn sàng.
- **Dữ liệu:** Thông tin đăng nhập của từng user; bài ACTIVE test.

**Bước thực hiện**

1. Login từng user; đối chiếu user.role và verificationStatus với fixture.
2. Với PENDING, GET /feed và GET /posts/{id} bằng token.
3. Với APPROVED, gọi GET /posts/{id} với bài ACTIVE hợp lệ.

**Kết quả mong đợi:** Trả đúng trạng thái/role; PENDING được feed giới hạn và bị 403 detail; APPROVED được detail theo quyền. Nếu API chưa có, ghi blocked, không đánh giá pass.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Blocked: endpoint/fixture feed/detail chưa triển khai (R06).
- **Kết quả thực tế / trạng thái TC cha:** Blocked; từng phần: EX-13A, EX-13B, EX-13C, EX-13D, EX-13E. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-14 — Khách truy cập chức năng yêu cầu xác thực

- **Mục tiêu:** Xác minh khách truy cập chức năng yêu cầu xác thực.
- **Truy vết:** CMP6-AC-05; BDD-14; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P0 / API/backend + UI.
- **Tiền điều kiện:** Không có session, môi trường có GET /feed.
- **Dữ liệu:** Không gửi Authorization.

**Bước thực hiện**

1. GET /feed trực tiếp không token.
2. Truy cập chức năng tương ứng trên UI.

**Kết quả mong đợi:** API trả 401 theo contract/D05, không trả feed; UI yêu cầu đăng nhập hoặc chặn truy cập, không hiển thị dữ liệu bảo vệ.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Blocked: endpoint bảo vệ chưa triển khai (R06).
- **Kết quả thực tế / trạng thái TC cha:** Blocked; UI /verification chuyển /login, nhưng API bảo vệ chưa triển khai nên chưa kiểm được server; từng phần: EX-14A, EX-14B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-15 — Email trống hoặc sai định dạng

- **Mục tiêu:** Xác minh email trống hoặc sai định dạng.
- **Truy vết:** CMP6-AC-01; BDD-15; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P1 / API/backend + UI.
- **Tiền điều kiện:** Mở đăng ký.
- **Dữ liệu:** email rỗng; "abc-khong-co-at".

**Bước thực hiện**

1. Với từng giá trị nhập trên UI rồi gửi.
2. POST /auth/request-otp trực tiếp với cùng dữ liệu.

**Kết quả mong đợi:** UI báo lỗi trường; API 400 validation; không gửi OTP hợp lệ hoặc tạo user/session.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng với môi trường test.
- **Kết quả thực tế / trạng thái TC cha:** Pass; các lớp API/UI đã kiểm; từng phần: EX-15A, EX-15B, EX-15C, EX-15D. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-16 — Mật khẩu không hợp lệ và xác nhận không khớp

- **Mục tiêu:** Xác minh mật khẩu không hợp lệ và xác nhận không khớp.
- **Truy vết:** CMP6-AC-01; BDD-16; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P1 / API/backend + UI.
- **Tiền điều kiện:** E_NEW đã verify và có ticket còn hạn.
- **Dữ liệu:** password="1234567"; PASSWORD_VALID và xác nhận khác.

**Bước thực hiện**

1. POST /auth/register với password 7 ký tự và ticket hợp lệ.
2. Trên UI nhập mật khẩu hợp lệ và xác nhận khác, gửi form.

**Kết quả mong đợi:** API từ chối password dưới 8 (400 validation), không user/session; UI ngăn gửi khi xác nhận khác theo validation FE; R03 ghi khác biệt giới hạn BE so với contract.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng; review R03 về BE/contract.
- **Kết quả thực tế / trạng thái TC cha:** Pass cho validation contract/FE; EX-16A/B Pass, R03 về giới hạn BE/contract cần review; từng phần: EX-16A, EX-16B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-17 — Dùng lại OTP hoặc ticket

- **Mục tiêu:** Xác minh dùng lại otp hoặc ticket.
- **Truy vết:** CMP6-AC-06; BDD-17; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P1 / API/backend.
- **Tiền điều kiện:** OTP_OK và ticket hợp lệ đã dùng thành công cho E_NEW.
- **Dữ liệu:** E_NEW, OTP_OK đã verify; ticket đã dùng.

**Bước thực hiện**

1. Verify lại cùng email và OTP.
2. POST register lần hai với ticket đã dùng.
3. Kiểm tra không có user thứ hai/session mới.

**Kết quả mong đợi:** Không có ticket mới từ OTP đã dùng; register không tạo user thứ hai hay phiên. Contract ticket một lần; R04 ghi nhận tiêu thụ độc lập cần review.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng cho kiểm thử tuần tự; review R04 về tiêu thụ ticket.
- **Kết quả thực tế / trạng thái TC cha:** Pass; từng phần: EX-17A, EX-17B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-18 — Gửi lại và OTP thuộc email khác

- **Mục tiêu:** Xác minh gửi lại và otp thuộc email khác.
- **Truy vết:** CMP6-AC-07; BDD-18; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P1 / API/backend.
- **Tiền điều kiện:** E_NEW và E_OTHER khác nhau, cả hai là email test cho phép; chính sách resend đã chốt.
- **Dữ liệu:** OTP_A của E_NEW; OTP_B của E_OTHER.

**Bước thực hiện**

1. Xin OTP cho E_NEW, chờ RESEND_WAIT rồi xin lại.
2. Verify mã cũ của E_NEW sau resend thành công theo quy tắc triển khai đã mô tả.
3. Xin OTP_B cho E_OTHER; POST verify với E_NEW và OTP_B (chọn các mã khác nhau).

**Kết quả mong đợi:** Bước 2: sau resend thành công, OTP cũ chưa xác thực bị từ chối; bước 3 bị từ chối, không trả ticket. Cấu hình dự án mặc định cooldown 60 giây, tối đa 5 mã/giờ/email; điều chỉnh theo môi trường thực tế. Không lưu OTP trong bằng chứng.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Sẵn sàng chạy lại theo cấu hình resend và fixture.
- **Kết quả thực tế / trạng thái TC cha:** Blocked; từng phần: EX-18A, EX-18B. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).


## TC-19 — Biên thời gian và số lần thử OTP

- **Mục tiêu:** Xác minh biên thời gian và số lần thử otp.
- **Truy vết:** CMP6-AC-07; BDD-19; xem ma trận cho liên kết FR/BR/AT đầy đủ.
- **Ưu tiên / lớp:** P1 / API/backend.
- **Tiền điều kiện:** Có đồng hồ giả/fixture test kiểm soát thời điểm truy vấn.
- **Dữ liệu:** OTP_TTL, MAX_OTP_ATTEMPTS, OTP_OK, OTP_BAD.

**Bước thực hiện**

1. Tạo OTP riêng cho từng mốc ngay trước, đúng và ngay sau thời điểm hết hạn.
2. Verify từng OTP đúng tại mốc tương ứng.
3. Với OTP mới, thử sai ở các mốc trước, tại và sau ngưỡng; thử đúng sau ngưỡng.

**Kết quả mong đợi:** Đối chiếu code hiện tại: truy vấn chỉ chọn OTP khi `expires_at > now()`; tại hoặc sau `expires_at` không chọn OTP. Không suy ra kết quả của request bắt đầu trước hạn nhưng hoàn tất sau hạn. Mỗi lần nhập sai tăng attempts; lần sai chạm ngưỡng trả 429 và sau đó mã đúng cũng bị từ chối khi OTP còn hiệu lực. Với mặc định, ngưỡng là 5. Dùng đồng hồ/fixture test riêng, không đánh giá biên bằng chờ thời gian không kiểm soát.

- **Dọn dữ liệu:** Theo README; xóa riêng user/OTP fixture tạo bởi ca nếu được phép, không đụng dữ liệu khác.
- **Sẵn sàng:** Cần đồng hồ test/fixture để chạy các mốc biên.
- **Kết quả thực tế / trạng thái TC cha:** Blocked; từng phần: EX-19A. **Bằng chứng:** [báo cáo thực thi](Test_Execution_Report.md).
