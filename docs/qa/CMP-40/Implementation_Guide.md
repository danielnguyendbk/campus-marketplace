# Hướng dẫn triển khai và nghiệm thu CMP-40

Các endpoint có tiền tố `/api/v1`. Hệ thống trả thành công theo envelope `{success, data, timestamp}`; danh sách phân trang có `meta`. Lỗi sử dụng `{error: {code, message, details?}, requestId?}`. Phân biệt `role` (`USER`, `ADMIN`) với `verificationStatus` (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`). Các điểm chưa thống nhất được quản lý tại [Cần xác nhận](API_Contract_Review.md).

## CMP-7 — Gửi hồ sơ và bảo vệ minh chứng

Người dùng PENDING hoặc REJECTED được gửi hoặc gửi lại `POST /me/evidence` bằng multipart. Hệ thống phải trả 201 và trạng thái PENDING sau khi nhận hợp lệ. `GET /me/verification` phải trả trạng thái, lý do và thời điểm nộp; giao diện phải thể hiện hồ sơ đang chờ duyệt. Người dùng bị từ chối phải nhận biết kết quả và được nộp lại. Không yêu cầu video hoặc vai trò Expert/Verifier.

| Trường | Điều kiện |
|---|---|
| `school` | Bắt buộc, chuỗi không rỗng, tối đa 255 ký tự |
| `studentCode` | Bắt buộc, chuỗi không rỗng, tối đa 50 ký tự |
| `cardImage` | Bắt buộc; JPEG/JPG hoặc PNG, tối đa 10 MiB |
| `major`, `className`, `cohort`, `province` | Tùy chọn; chuỗi, tối đa lần lượt 255, 100, 50, 100 ký tự |

Ảnh và dữ liệu minh chứng phải được lưu riêng tư; chỉ ADMIN được xem ảnh qua đường dẫn có thời hạn phục vụ xét duyệt. API trạng thái và profile thông thường không được trả URL ảnh; UI không hiển thị lại ảnh. Gửi thiếu dữ liệu trả 400 `VALIDATION_FAILED`; ảnh sai loại 415 `UNSUPPORTED_MEDIA_TYPE`; quá giới hạn 413; guest 401; tài khoản APPROVED nhận 400 `ALREADY_APPROVED`, SUSPENDED nhận 403 `ACCOUNT_SUSPENDED`. Mã chi tiết 413 tại interceptor cần xác nhận qua kiểm thử biên.

PENDING được xem feed ACTIVE rút gọn; hệ thống phải chặn search/filter, chi tiết, tạo tin và tương tác phía server. Tính khả dụng feed/search và giới hạn JWT cũ phải được nghiệm thu riêng, không suy ra từ UI.

**Điều kiện chấp nhận**

- [ ] Hồ sơ hợp lệ được ghi nhận PENDING; UI trạng thái và nộp lại hoạt động.
- [ ] Các trường bắt buộc, giới hạn và lỗi được kiểm ở API; người không có quyền không truy cập được ảnh.
- [ ] Kiểm chứng URL ảnh hoạt động, hết hạn và không lộ qua API cá nhân; kiểm feed và chặn tương tác trực tiếp.

## CMP-8 — Admin xét duyệt

ADMIN được gọi `GET /admin/verifications?status=PENDING&page=1&limit=20` để xem hàng đợi; `status` là bộ lọc tùy chọn, `page` tối thiểu 1, `limit` 1–100, mặc định 20. `GET /admin/verifications/{verificationId}` cung cấp hồ sơ phục vụ xét duyệt và ghi nhận truy cập minh chứng. Guest bị từ chối 401, USER bị từ chối 403 `FORBIDDEN`.

ADMIN dùng `PATCH /admin/verifications/{verificationId}` với `{ "decision": "APPROVED" | "REJECTED", "reason": "..." }`. REJECTED phải có reason không rỗng sau khi bỏ khoảng trắng, tối đa 500 ký tự; APPROVED không bắt buộc reason theo giao diện hiện có. Khi duyệt, hệ thống cập nhật APPROVED; khi từ chối, cập nhật REJECTED, giữ lý do và tạo thông báo kết quả. Lưu audit gồm người quyết định, đối tượng, quyết định, thời điểm và lý do áp dụng. Không biến verification status thành role.

**Điều kiện chấp nhận**

- [ ] List/detail và quyết định chỉ được ADMIN truy cập; từ chối thiếu/lý do trắng bị 400.
- [ ] Người dùng thấy kết quả; đối chiếu trạng thái, notification và audit trong DB test.
- [ ] Dùng JWT còn hạn trước khi thay đổi trạng thái để kiểm tra quyền trên các endpoint liên quan; ghi rõ khác biệt giữa guard.

## CMP-9 và CMP-10 — Tạo tin

Người dùng APPROVED được gửi `POST /posts` multipart. Guest nhận 401; USER PENDING/REJECTED nhận 403 `ACCOUNT_NOT_VERIFIED`; SUSPENDED nhận 403 `ACCOUNT_SUSPENDED`. Guard tạo tin cho phép ADMIN không SUSPENDED; kiểm riêng ADMIN và đối chiếu yêu cầu quyền tại [Cần xác nhận](API_Contract_Review.md). Quyền phải được kiểm trực tiếp qua API và theo trạng thái hiện hành, không chỉ bằng nút UI.

Mọi tin cần `postType`, `title`, `description`, `categoryId`, `province`; các chuỗi không rỗng sau trim; title tối đa 255, categoryId và province tối đa 100 ký tự; danh mục phải active. Tin tạo thành công trả 201, loại đã chọn và `ACTIVE`; người có quyền được xem lại qua `GET /posts/{id}` và `GET /me/posts`.

| Loại | Điều kiện |
|---|---|
| SELL | `price` tối thiểu 0.01, `condition` không rỗng tối đa 255 ký tự, 1–5 `images`; `allowPhoneReveal` tùy chọn, mặc định true. Không gửi `budgetMin`/`budgetMax`. |
| BUY_REQUEST | `budgetMin`, `budgetMax` là số ≥0, `budgetMax ≥ budgetMin`; ảnh tùy chọn, tối đa 5. Không gửi `price`, `condition`, `allowPhoneReveal`. |

Ảnh chấp nhận JPEG, PNG, WebP, mỗi ảnh >0 và ≤10 MiB. Dữ liệu không hợp lệ trả 400 `VALIDATION_FAILED`, MIME sai 415 `UNSUPPORTED_MEDIA_TYPE`, kích thước ảnh không hợp lệ 413 `PAYLOAD_TOO_LARGE`; chênh lệch giữa ngưỡng giá và OpenAPI cần được xác nhận.

**Điều kiện chấp nhận**

- [ ] Kiểm ma trận guest/PENDING/APPROVED/ADMIN và SUSPENDED cho cả hai loại qua API trực tiếp.
- [ ] Kiểm từng trường, biên số/ảnh, danh mục và trường chéo; đối chiếu tin được lưu, loại, ACTIVE và xem lại.

## CMP-34 — Health khi DB lỗi

Khi kết nối DB đã cấu hình không khả dụng, `GET /health` và `GET /api/v1/health` phải trả HTTP 200, `data.status: degraded`, `data.database.status: disconnected`, thông báo chung `Database connection unavailable`. Response không được lộ credentials, tên user DB, cấu hình, lỗi driver hoặc stack; log phải lọc thông tin nhạy cảm. Không gán cùng oracle cho tình huống DB chưa cấu hình (`not_configured`); phạm vi health contract cần xác nhận vì OpenAPI chưa mô tả operation.

**Điều kiện chấp nhận**

- [ ] Trên môi trường test riêng, mô phỏng lỗi kết nối, gọi endpoint và kiểm tra envelope, trạng thái và thông báo.
- [ ] Kiểm response và log server đã làm sạch, bao gồm các loại dữ liệu nhạy cảm nêu trên; ghi rõ lỗi giả lập và phạm vi quan sát.
- [ ] Không coi harness với DB giả là kiểm thử tích hợp DB thật. Kết quả trước đây: [T11](Test_Execution_Report.md#kết-quả-đã-chạy).

## CMP-35 — FE phân biệt lỗi OTP (chưa triển khai)

FE phải xử lý theo `error.code`, không chỉ HTTP 429. Với `OTP_ATTEMPTS_EXCEEDED`, UI phải thông báo đã vượt số lần thử và hướng dẫn yêu cầu OTP mới khi BE cho phép. Với `OTP_RATE_LIMITED`, UI phải hướng dẫn chờ theo cooldown hoặc retry metadata mà API thực sự cung cấp; không tự đặt thời gian hoặc đếm ngược. Hai lỗi đều giữ bước tạo mật khẩu đóng. Chỉ chuyển bước sau khi verify OTP thành công và nhận ticket hợp lệ; mã sai, hết hạn, bị giới hạn hoặc phản hồi lỗi không được mở bước này.

Khi thiếu retry metadata, UI phải đưa hướng dẫn chờ chung, không hiển thị thời gian tự suy đoán. Với mã lỗi không nhận diện, UI phải giữ bước hiện tại, đưa thông báo lỗi chung an toàn và không giả định loại lỗi; nội dung chính xác và cách thử lại cần FE/BE/PM xác nhận. Hợp đồng hiện được rà soát chưa xác định trường retry metadata; không tự tạo field.

**Điều kiện chấp nhận FE**

- [ ] Hai error code cùng HTTP 429 tạo hai hướng dẫn đúng; kiểm riêng request/resend và verify khi áp dụng.
- [ ] OTP sai/hết hạn/429 không mở password; verify thành công với ticket hợp lệ mới được chuyển bước.
- [ ] Thiếu metadata và code lạ được xử lý an toàn; kiểm thử mock và FE–BE thật ghi riêng.
- [ ] Bằng chứng UI mock cũ mô tả bản hiện tại, không phải nghiệm thu ticket; xem T12.

## CMP-37 — Phối hợp BE/BA kiểm chứng (chưa hoàn tất)

**Oracle trước khi chạy:** Một ticket verify hợp lệ chỉ được sử dụng thành công một lần. Replay phải bị từ chối; các request cạnh tranh cùng ticket không được tạo quá một user và một phiên thành công. Một lần 409 email trùng không đủ chứng minh ticket đã consume. Kiểm tra độc lập trạng thái ticket, số user và số response session thành công; không lưu ticket/session trong evidence.

**Tiền điều kiện:** xác minh DB test riêng theo [README](README.md#điều-kiện-an-toàn-khi-tái-hiện); fixture email giả duy nhất, mail test double và đồng hồ/fixture thời gian được cấp phép; ghi TTL, attempts, cooldown và quota thực tế từ cấu hình test hoặc contract, không dùng mặc định làm kết luận môi trường. Hộp thư và SMTP thật chỉ được dùng khi đã cấp phép.

1. Xin và xác thực OTP; giữ ticket trong bộ nhớ test, ghi số user và tình trạng ticket ban đầu mà không ghi giá trị nhạy cảm.
2. Gửi register hợp lệ, ghi số response thành công/session và user; replay cùng ticket. Xác minh replay bị từ chối, ticket đã consume/không còn hiệu lực, số user và session thành công không tăng. Không kết luận chỉ từ 409.
3. Với fixture mới, đồng thời gửi nhiều request register cùng ticket; đợi tất cả hoàn tất, đếm thành công/session/user và đọc trạng thái ticket. Kỳ vọng một lần thành công, một user, một session thành công và ticket không dùng lại được. Chạy race verify nếu cần để chứng minh chỉ cấp một ticket.
4. Với fixture riêng, kiểm trước/tại/sau hạn, các lần sai sát ngưỡng và sau ngưỡng; kiểm trước/sau cooldown, quota, resend, từ chối mã/ticket cũ và chấp nhận mã mới. Ghi cấu hình và đồng hồ thực tế; không lộ mã.
5. Khi có SMTP và hộp thư test được cấp phép, kiểm gửi/nhận thật và luồng tiếp theo; nếu thiếu thì Blocked, nêu điều kiện còn thiếu.

**Điều kiện chấp nhận**

- [ ] BE/BA thống nhất oracle và fixture; kết quả replay/race có đủ ba phép quan sát ticket, user, session.
- [ ] Biên TTL, resend, attempts và rate limit có bằng chứng theo cấu hình môi trường.
- [ ] SMTP thật được xác nhận hoặc ghi Blocked. Kết quả repository 7/7 đã chạy chỉ chứng minh phạm vi SQL/repository, không mặc định có lỗ hổng hay đã nghiệm thu API.

## CMP-36 — ErrorEnvelope details

Schema `ErrorEnvelope.error.details.items` phải là object có `additionalProperties: false`. Ví dụ item hợp lệ: `{"field":"school","message":"Bắt buộc"}`. Ví dụ không hợp lệ: `{"field":"school","message":"Bắt buộc","extra":"không được phép"}`. Các ví dụ chỉ minh họa item, không tuyên bố các trường đều bắt buộc khi schema không quy định.

**Điều kiện chấp nhận**

- [ ] Trình xác thực schema chấp nhận item hợp lệ và từ chối item có thuộc tính thừa.
- [ ] Chạy `node docs/qa/CMP-40/evidence/schema-check.cjs` với dependency đã cài; script đọc schema trong OpenAPI và validate hai mẫu.
- [ ] Ghi Pass trong phạm vi item; không suy rộng sang toàn bộ OpenAPI hoặc API runtime. Keyword còn dư ở cấp array cần review riêng.
