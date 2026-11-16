# CMP-30 — BDD và kiểm thử đăng ký OTP, đăng nhập

**Trạng thái: đã thực thi một phần trên môi trường local; chờ review**, chưa có xác nhận BE/FE/PM. Xem [báo cáo thực thi](Test_Execution_Report.md) cho trạng thái tách theo lớp, bằng chứng và giới hạn SMTP. Phạm vi là CMP-6 và các điểm kiểm soát quyền đại diện cần chứng minh AC; không bao gồm kiểm thử đầy đủ hồ sơ sinh viên, feed hay bảo mật toàn hệ thống.

## Đầu ra và cách dùng

- `CMP-6-auth.feature`: Gherkin, mỗi scenario có tag mã BDD ổn định; `@review` đánh dấu điểm còn sai khác cần review; `@dependency` đánh dấu phụ thuộc triển khai, không biểu thị đã Pass. `@required` theo CMP-6/CMP-30; `@proposed` là đề xuất bổ sung.
- `Test_Cases.md`: tiền điều kiện, bước, oracle và trạng thái cho từng ca; tham số được định nghĩa bên dưới. Không sử dụng tài khoản thật hoặc lưu OTP/token trong bằng chứng.
- `Traceability_Matrix.md`: truy vết từng AC và DoD; `Jira_Handover.md`: nội dung để người dùng dán, checklist và chữ ký review.
- Các ca cần môi trường test cô lập; trạng thái sẵn sàng, review và kết quả thực thi là các thuộc tính riêng. Cấu hình thực tế có thể override mặc định dự án.

## Nguồn và giới hạn

1. Hồ sơ gốc [v1.2](../../../../Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx), ngoài repo, cùng thư mục cha `project`: mục 2, 3.1, 4 FR-01, 5 BR-01/02/04, 9.2, 10 AT-01, 11 tham số cấu hình. Tham chiếu theo mục vì DOCX không có dòng ổn định. Hồ sơ ghi bản v1.2 đã cập nhật theo quyết định nhóm.
2. [Quyết định kiến trúc D03, D05, DB08](../../ARCHITECTURE.md) §10.3–10.4: D03 chốt nội bộ cho domain kết thúc `.edu.vn`, D05 chốt feed; DB08 mô tả thiết kế chuẩn hóa email và ticket; các giá trị mặc định dự án được đối chiếu với mẫu cấu hình và code dưới đây. [Business rules](../../business-rules/README.md) mục 1 và [authorization matrix](../../architecture/authorization_matrix.md).
3. [OpenAPI](../../../packages/api-contract/openapi.yaml) `/auth/request-otp`, `/auth/verify-otp`, `/auth/register`, `/auth/login`, `/feed`, schemas `RequestOtpBody`, `VerifyOtpBody`, `RegisterBody`, `LoginBody`, `AuthSession`; đây là hợp đồng kỹ thuật, phân biệt với hồ sơ và thực thi.
4. BE: [controller](../../../apps/backend/src/modules/auth/auth.controller.ts), [OTP service](../../../apps/backend/src/modules/auth/otp.service.ts), [auth service](../../../apps/backend/src/modules/auth/auth.service.ts), [OTP repository](../../../apps/backend/src/modules/auth/repositories/otp.repository.ts), [user repository](../../../apps/backend/src/modules/auth/repositories/user.repository.ts), [DTO](../../../apps/backend/src/modules/auth/dto/), [email util](../../../apps/backend/src/modules/auth/utils/email.util.ts), [config](../../../apps/backend/src/config/env.config.ts), [E2E](../../../apps/backend/test/auth.e2e-spec.ts) và unit tests `otp.service.spec.ts`, `auth.service.spec.ts`, guard spec.
5. FE: [auth README](../../../apps/frontend/src/features/auth/README.md), [register form](../../../apps/frontend/src/features/auth/components/register-form.tsx), [login form](../../../apps/frontend/src/features/auth/components/login-form.tsx), [validation](../../../apps/frontend/src/features/auth/types.ts), [API tests](../../../apps/frontend/src/test/api.test.ts), [UI tests](../../../apps/frontend/src/test/App.test.tsx). [QA trước đây](../CMP-6-integration-checklist.md) là báo cáo lịch sử, không phải kết quả của bộ này; [handoff](../../../tasks/AGENT_HANDOFF.md) là trạng thái lịch sử. Jira CMP-6/CMP-30 được dùng theo nội dung người giao cung cấp; chưa đối chiếu trực tiếp Jira hay Apidog.

## Luồng và quy định có căn cứ

- Hồ sơ §3.1: nhập tên hiển thị và email trường, kiểm tra hợp lệ/chưa tồn tại/domain cấu hình; gửi và xác thực OTP trước bước tạo mật khẩu; sau OTP đúng, tạo user PENDING và đến hồ sơ sinh viên. FR-01: gửi/kiểm OTP, chặn email trùng và domain không hợp lệ. BR-01: OTP trước password hoặc phiên hợp lệ; BR-02: domain Admin cấu hình, email duy nhất. AT-01: email → OTP đúng → password → nộp hồ sơ và ảnh; chưa OTP không tạo account, sau nộp PENDING, không vào Marketplace. Bộ này chỉ kiểm phần auth của AT-01; nộp hồ sơ/ảnh cần bộ khác.
- Hồ sơ §2, §3.1 và BR-04: PENDING được đăng nhập, hoàn thiện hồ sơ, xem trạng thái và feed ACTIVE giới hạn; không search/filter/detail/post/chat/report/điện thoại. REJECTED được xem lý do, cập nhật/nộp lại; contract `/auth/login` cho phép login REJECTED và chặn SUSPENDED. APPROVED có quyền marketplace tương ứng; role kỹ thuật USER/ADMIN và trạng thái là hai trục khác nhau. Guest bị chặn feed theo D05. Không suy ra PENDING là chưa verify email.
- Contract yêu cầu `email` khi xin OTP; `email`, `code` khi verify; `otpTicket`, `displayName`, `password` khi register; `email`, `password` khi login. Password contract tối thiểu 8 ký tự, displayName 1–255; code đầu vào 4–12 ký tự là validation contract, **không chứng minh OTP được phát có độ dài 4–12 theo nghiệp vụ**. Contract không yêu cầu confirmPassword; FE có trường xác nhận. API trả ticket sau verify, register 201 trả session PENDING, login 200; request OTP cho email tồn tại phản hồi trung tính (không tiết lộ tồn tại), register chặn trùng. Không yêu cầu thông báo trùng ngay tại request OTP.
- D03 chốt nội bộ `.edu.vn`; BR-02 yêu cầu danh sách cấu hình Admin. Email theo contract `format: email`; BE chuẩn hóa trim/lowercase như mô tả dưới đây.

## Quy định triển khai và cấu hình dự án

Căn cứ nhóm đã thống nhất nghiệp vụ theo chỉ đạo hiện tại; dưới đây mô tả hợp đồng và thực thi ở commit `00494ba316d37218bd2f903546141085b35f7739`. Cấu hình `.env.example` là **mặc định mẫu của dự án**, không chứng minh giá trị đang áp dụng trên môi trường cụ thể. Khi chạy test, đọc cấu hình môi trường test được cấp phép, không đọc hay công bố secret. Nguồn chính: [mẫu cấu hình BE](../../../apps/backend/.env.example) dòng 23–34; [env.config.ts](../../../apps/backend/src/config/env.config.ts) 63–81; [OTP service](../../../apps/backend/src/modules/auth/otp.service.ts) 39–190 và [OTP repository](../../../apps/backend/src/modules/auth/repositories/otp.repository.ts) 28–136; [OpenAPI](../../../packages/api-contract/openapi.yaml) `/auth/*` và schemas.

- **OTP:** backend phát 6 chữ số. Mặc định TTL `OTP_TTL_SECONDS=600` giây (10 phút), tối đa `OTP_MAX_ATTEMPTS=5` lần sai cho mỗi OTP. Code tính `expires_at = now + TTL` tại lần yêu cầu, trước khi gửi mail; Truy vấn chọn OTP hoạt động yêu cầu `expires_at > now()` tại thời điểm truy vấn; bằng hoặc sau mốc đó không chọn OTP. Code không kiểm tra lại `expires_at` khi đánh dấu verified, nên không suy rộng kết luận này cho mọi trường hợp xử lý qua mốc hạn. Mỗi lần đối chiếu mã sai hợp lệ làm tăng attempts; 4 lần sai đầu trả 400 `OTP_INVALID`, lần sai thứ 5 và các lần sau trả 429 `OTP_ATTEMPTS_EXCEEDED` khi OTP vẫn còn hiệu lực, kể cả khi sau đó nhập đúng; yêu cầu mã mới. Khi OTP hết hạn, truy vấn không chọn bản ghi và backend trả `OTP_INVALID`. Các ví dụ ngưỡng trên áp dụng mặc định 5, nếu môi trường override thì thay bằng cấu hình test. Logic biên là **hành vi code hiện tại**, kiểm tra đồng hồ/fixture riêng; chưa có kết quả thực thi chính xác ở biên.
- **Gửi lại:** mặc định `OTP_RESEND_COOLDOWN_SECONDS=60`, `OTP_MAX_PER_HOUR=5` yêu cầu mỗi email trong cửa sổ một giờ; trước 60 giây hoặc đã đạt giới hạn trả 429 `OTP_RATE_LIMITED`. Lần gửi mới hợp lệ làm hết hiệu lực OTP cũ chưa verify trước khi tạo mã mới. Code đếm các bản ghi OTP trong một giờ gần nhất; lưu ý nếu gửi email lỗi thì bản ghi đã tạo bị hết hạn nhưng vẫn có thể nằm trong thống kê. Đây là quy tắc triển khai cấu hình, không khẳng định đã chạy mọi biên.
- **Phiên thử Codex trước:** TTL 600, attempts 5, allowlist `edu.vn` trùng mặc định; **cooldown 1 giây và 20 mã/giờ là override để test**, không phải mặc định dự án. `EX-18B` và `EX-19A` giữ Blocked theo kết quả lịch sử, nay có oracle để chạy lại, không tự chuyển Pass.
- **Email:** mẫu `ALLOWED_SCHOOL_DOMAINS=edu.vn`, theo D03 `.edu.vn`; BE `trim().toLowerCase()`, so khớp domain cấu hình chính xác hoặc subdomain và kiểm email đã có bằng giá trị chuẩn hóa. `existsByEmail` tính cả email soft-delete ([user repository](../../../apps/backend/src/modules/auth/repositories/user.repository.ts) 23–31); đây là hành vi hiện tại. BE chấp nhận cả domain gốc `edu.vn`, trong khi FE yêu cầu có ít nhất một nhãn trước `.edu.vn` ([email util](../../../apps/backend/src/modules/auth/utils/email.util.ts) 1–33; [FE types](../../../apps/frontend/src/features/auth/types.ts) 60–65): ghi sai khác R05 để review, không giả định một phía đúng. Địa chỉ phải có định dạng email theo contract/DTO.
- **Đầu vào đăng ký:** request OTP cần email; verify cần email và code 4–12 ký tự theo contract; register cần ticket, tên hiển thị 1–255 ký tự, password ít nhất 8 ký tự; BE hiện giới hạn password 72 ký tự ([register DTO](../../../apps/backend/src/modules/auth/dto/register.dto.ts)); UI yêu cầu xác nhận trùng password ([register form](../../../apps/frontend/src/features/auth/components/register-form.tsx) 183–189). Contract không nêu max 72 hoặc xác nhận password; ghi R03 để review, không mở rộng yêu cầu gốc một cách ngầm định.
- **Email trùng:** `/auth/request-otp` trả 200 trung tính và không phát OTP mới nếu email đã tồn tại; `/auth/register` trả 409 `EMAIL_ALREADY_REGISTERED` khi ticket ứng với email đã có, kể cả xung đột unique. Như vậy chặn tạo account trùng mà không tiết lộ qua yêu cầu OTP ([OpenAPI](../../../packages/api-contract/openapi.yaml) `/auth/request-otp`, `/auth/register`; [auth.service.ts](../../../apps/backend/src/modules/auth/auth.service.ts) 45–73).
- **OTP và phiên:** verify đúng trả `otpTicket` ngắn hạn; ticket có TTL dùng `OTP_TTL_SECONDS` (mặc định 600 giây, tính từ lúc ký). Register yêu cầu ticket hợp lệ, lấy email từ ticket, tạo `USER/PENDING` rồi trả session 201. PENDING và REJECTED đăng nhập được, SUSPENDED bị chặn; sai email/mật khẩu trả 401 `INVALID_CREDENTIALS`. Contract yêu cầu ticket một lần; code kiểm tra ticket và email trùng nhưng chưa thấy đánh dấu tiêu thụ độc lập: R04 cần review, không khẳng định đã có lỗi hoặc an toàn trong race.

## Tham số và dữ liệu kiểm thử

`D_ALLOW` lấy từ cấu hình thực tế của môi trường test (mẫu dự án `edu.vn`); `D_DENY` là domain ngoài allowlist; `E_NEW = cmp30-new@<D_ALLOW>`, `E_OTHER = cmp30-other@<D_ALLOW>`, `E_EXIST = cmp30-exist@<D_ALLOW>`, dùng hộp thư test hoặc mail console được phép. Nếu `D_ALLOW=edu.vn`, dùng subdomain test để phù hợp FE, ví dụ `test.edu.vn`. `OTP_TTL`, `MAX_OTP_ATTEMPTS`, `RESEND_WAIT`, `RESEND_LIMIT` lấy từ cấu hình môi trường đang chạy; giá trị mặc định tương ứng 600 giây, 5, 60 giây, 5/giờ. `OTP_OK` lấy từ mail console/hộp thư; `OTP_BAD` khác OTP thật và hợp lệ định dạng. `PASSWORD_VALID` tuân theo contract và BE; không ghi OTP/password/token/ticket vào bằng chứng.

## Kết quả rà soát Q01–Q09

| Mã | Kết luận, nguồn và tác động | Trạng thái |
|---|---|---|
| Q01 | Giá trị mặc định, cách đếm, mốc hạn và resend được cụ thể hóa ở trên; `OTP_TTL_SECONDS` có thể override. `EX-18B`, `EX-19A` vẫn giữ kết quả lịch sử, cần chạy lại theo oracle mới. | Đóng về quy định; kiểm thử biên chưa chạy |
| Q02 | D03, cấu hình `edu.vn`, chuẩn hóa và cách so trùng ghi ở trên; lệch FE/BE domain gốc tách R05. | Đóng về cấu hình và thực thi; R05 review |
| Q03 | Hồ sơ §3.1 đặt nhập tên trước OTP; FE nhận tên sau verify, contract nhận tên ở register. Không tự chọn phía nào. | Sai khác R01 cần review |
| Q04 | Hồ sơ §3.1/contract tạo user PENDING ngay sau OTP/password; §2/BR-04/D05 cho PENDING feed giới hạn. AT-01 nói sau nộp PENDING không vào Marketplace, diễn đạt có thể gây hiểu sai phạm vi feed. | Quy tắc PENDING đã rõ; sai khác diễn đạt R02 review |
| Q05 | Contract password ≥8; BE 8–72, FE xác nhận khớp. Max 72 và confirm không được mô tả trong contract; không tự coi là yêu cầu gốc. | R03 review giới hạn BE/contract; xác nhận là validation UI hiện có |
| Q06 | FR-01 chặn trùng và contract bảo mật request OTP được thực hiện theo hai thời điểm nêu trên; soft-delete theo repository. | Đóng về quy định triển khai; fixture race không thuộc bằng chứng đã chạy |
| Q07 | Contract ticket ngắn hạn, một lần; TTL mặc định 600 giây; EX-17B chỉ chứng minh gọi lại sau tạo user bị 409. Chưa thấy đánh dấu tiêu thụ ticket độc lập trong code. | R04 cần BE review việc đáp ứng contract; không suy ra pass đồng thời |
| Q08 | Login sai: 401, UI thông báo lỗi; PENDING/APPROVED theo hồ sơ và contract, guest feed 401 theo D05. UI 429 gộp thông báo theo báo cáo QA trước. Feed/detail/hồ sơ chưa triển khai ở commit kiểm thử. | Quy tắc đã rõ; R06 là phụ thuộc triển khai và review thông điệp 429 |
| Q09 | Contract `/auth/register` trả `AuthSession` 201; code cấp session sau verify OTP và tạo user. BR-01 được thỏa về thứ tự, không cần login riêng. | Đóng |

### Sai khác và phụ thuộc cần review

| Mã | Nội dung / nguồn | Tác động |
|---|---|---|
| R01 | Hồ sơ v1.2 §3.1 nhập tên cùng email trước OTP; FE hiện yêu cầu tên sau OTP (`register-form.tsx`). | Review thứ tự UI; không đổi yêu cầu gốc. |
| R02 | AT-01 “không vào Marketplace” trong khi §2, §3.1, BR-04 và D05 cho PENDING feed hạn chế. | Review cách hiểu AT-01; không phủ nhận quyền feed giới hạn đã nêu rõ. |
| R03 | BE password tối đa 72 nhưng `RegisterBody` contract chỉ có min 8; confirm là validation FE, không có trong contract. | Review tương thích contract và thông báo validation. |
| R04 | Contract ticket một lần; code chưa thấy tiêu thụ độc lập, EX-17B chỉ chặn trùng sau tạo user. | BE review tuân thủ, đặc biệt khả năng đồng thời; chưa kết luận lỗi. |
| R05 | BE chấp nhận `@edu.vn`, FE yêu cầu tên miền con; D03 diễn đạt `.edu.vn`. | Review đồng bộ định dạng được phép; không áp đặt oracle khác cho AC. |
| R06 | `GET /feed`, `/posts/{id}`, `/me/verification` chưa được controller triển khai tại commit chạy; QA lịch sử nêu FE gộp lỗi 429. | Kiểm tra quyền server/feed và thông điệp khi tính năng sẵn sàng; các EX Blocked không đổi. |

## Thiết lập và bằng chứng

Chạy trên môi trường test cô lập, có hộp thư test và cách lấy mã được cấp phép; không brute-force hash hoặc lộ secret. Dùng BASE_URL của môi trường, prefix `/api/v1` theo contract, kiểm tra cấu hình thực tế; các lời gọi chỉ dùng method/path contract. Dùng đồng hồ giả hoặc fixture/test hook được BE cấp cho biên thời gian, không sửa dữ liệu production. Kiểm số user qua quan sát DB chỉ đọc hoặc test fixture được cấp quyền; dọn duy nhất dữ liệu test theo quy trình môi trường. Thành công/lỗi theo envelope contract; không ghi giá trị nhạy cảm vào bằng chứng. Kết quả phiên local và các mục chưa thực hiện được ghi trong báo cáo thực thi; không dùng kết quả cũ thay cho phiên này.

## Kết quả rà soát sau thực thi

Các kết luận Q01–Q09 hiện ở bảng trên; [báo cáo thực thi](Test_Execution_Report.md) giữ nguyên kết quả và nêu các phụ thuộc. SMTP thật và guard feed/detail chưa được xác minh.
