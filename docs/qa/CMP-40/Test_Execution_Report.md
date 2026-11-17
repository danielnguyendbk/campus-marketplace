# Báo cáo thực thi CMP-40

Ngày 17-11-2026, commit `8f450ce589f1a4bbaf173d791fccfa14a01511a2`, Node 20.20.1, pnpm 10.14.0, macOS; PostgreSQL 17.11 tạm. Kết quả dưới đây thuộc phiên kiểm thử trước; lần chỉnh tài liệu này không chạy test hay kết nối DB. CMP-7/8/9/10/34/36 đã được dev triển khai; CMP-35 chưa triển khai và CMP-37 chưa hoàn tất theo thông tin người giao. Kết quả Fail của T12 mô tả bản hiện tại so với oracle CMP-35, không phải regression của ticket đã hoàn thành. Kết quả Pass một phần không chuyển cả test case thành Pass. Evidence là script tái hiện và tóm tắt đã lọc, không lưu log thô nhạy cảm.

## Kết quả đã chạy

| Ca / cách chạy | Actual result | Trạng thái và phạm vi |
|---|---|---|
| T01/T02 `pnpm test:e2e`, verification suite | 9 test HTTP qua Supertest Pass, gồm guest, thiếu ảnh/trường, MIME, PENDING, nộp lại, APPROVED | Pass phần mock: EvidenceRepository, DB và StorageService giả; chưa kiểm ảnh >10 MiB hoặc storage thật |
| T05/T06 `pnpm test:e2e`, admin suite | 9 test HTTP Pass, gồm 401/403, list/detail, approve/reject, audit mock | Pass phần mock; không chứng minh transaction/audit DB hay URL thực |
| T07 `pnpm test`, verification guard unit | guard tests chạy Pass trong 25 suite backend thành công | Pass phần unit DB giả; không chạy chuỗi JWT cũ và DB thật |
| T01/T04 `pnpm --filter @campus/frontend test` | 2 files, 58/58 Pass, gồm UI PENDING và nộp minh chứng | Pass UI dùng transport/client mock; không chứng minh tích hợp BE/FE |
| T11 `node evidence/health-check.cjs` | HTTP 200; degraded/disconnected; `Database connection unavailable`; response không chứa credential giả, địa chỉ giả, ECONNREFUSED hay stack; log bắt được không chứa credential giả/URL | Pass phạm vi harness Nest controller/service thật, DB giả tại loopback cổng không mở. Không kiểm mọi dạng lỗi driver hoặc mọi thông tin nhạy cảm trong log; không kiểm server deploy. OpenAPI không có operation health. |
| T12 bản hiện tại, test `evidence/otp-429.test.tsx` qua Vitest | ATTEMPTS: alert “Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lát rồi thử lại.”, không có hướng dẫn mã mới → **Fail**; RATE_LIMITED có hướng dẫn chờ → Pass; cả hai không mở password | UI React với client mock ném hai ApiError 429; không phải tích hợp BE/FE hoặc nghiệm thu CMP-35 chưa triển khai |
| T13 `node evidence/schema-check.cjs` | Ajv nhận `{field,message}` và từ chối item có `extra`; items `additionalProperties=false` | Pass kiểm schema item; Ajv strict:false, compile riêng schema item; không kiểm keyword ở cấp array và không validate toàn spec |
| T14/T15 `DATABASE_URL=<local test> pnpm --filter @campus/backend exec jest --config ./test/jest-e2e.json --runInBand cmp37-otp-race-isolated-db` | 7/7 Pass trên cụm PostgreSQL tạm: race markVerified/consume 5 lần mỗi loại có đúng một thành công, replay false, revoke, biên SQL, insert cùng email có một user, xóa schema | Pass mức repository/SQL; test consume và insert là hai phép thử tách biệt, không đếm session và không chứng minh HTTP registration end-to-end |
| T14/T15 `auth.e2e-spec.ts` trong E2E | 9 test Pass, gồm EX-17B/18B/19A | HTTP với OTP/User repository và mail giả; không phải PostgreSQL thật hay SMTP thật |
| DoD `pnpm lint` | exit 0 | Pass |
| DoD `pnpm test` | 25 suite BE Pass, 149 test Pass; 3 suite không compile do thiếu multer/type | Fail môi trường dependency; lệnh workspace dừng tại BE; FE đã chạy riêng như trên |
| DoD `pnpm typecheck`, `pnpm build` | thất bại: không tìm thấy `multer` / `Express.Multer` | Fail môi trường dependency; chưa xác định có lỗi khác sau khi cài đúng |
| DoD `pnpm test:e2e` sau cấp loopback | 7 suite Pass, 2 suite không compile (`posts`, `app`) do thiếu Multer; 85 test Pass | Toàn lệnh Fail; 7 suite gồm suite DB bị ảnh hưởng bởi sự cố môi trường bên dưới; không tính lần này là bằng chứng DB cô lập |

Lần chạy E2E đầu trong sandbox bị chặn `listen EPERM`: 58 fail, 27 pass; không dùng làm kết luận sản phẩm. Thử `pnpm install --offline --frozen-lockfile` xuất hiện câu hỏi xóa và cài lại modules; không xác nhận, không coi dependency được sửa. Lần chạy DB local đầu chọn nhầm role mặc định, không kết nối được; chạy lại với role của cụm tạm đạt 7/7 rồi dừng server. Các script và cách chạy nằm trong [README](README.md).

## Sự cố chạy ngoài phạm vi DB dự kiến

Lệnh E2E toàn bộ sau khi mở loopback đã để `cmp37-otp-race-isolated-db.e2e-spec.ts` tự nạp `apps/backend/.env`; kiểm tra phân loại sau đó cho thấy URL trong file trỏ tới DB **không phải localhost**. Test này thực hiện `DROP SCHEMA IF EXISTS cmp37_isolated_test CASCADE`, tạo fixture, chạy 7 test và xóa schema cuối. Kết quả suite Pass thể hiện đã kết nối và chạy; chưa xác minh được schema cùng tên có tồn tại hoặc chứa dữ liệu trước đó. Vì vậy không thể khẳng định không có dữ liệu bị mất. Không ghi địa chỉ/credential; người quản trị DB cần kiểm tra audit/backup và xác nhận ảnh hưởng. Đây là sai sót thực thi, không phải bằng chứng được phép dùng cho test DB cô lập.

## Blocked và Not Run

| Ca | Trạng thái | Trở ngại và cách gỡ |
|---|---|---|
| T03, T05–T06 phần storage/audit | Blocked | Cần DB và storage test cô lập, tài khoản/fixture, route URL thật; đo quyền, hạn URL, audit/notification trong DB. |
| T04 feed/search | Blocked | Chưa thấy controller GET feed/search; CMP-30 R06 liên kết feed CMP-12. Cần PM xác định story search; detail đã có nhưng kiểm trực tiếp chưa chạy. |
| T07 | Blocked | Cần chạy JWT cũ qua API với thay đổi trạng thái DB thật; lưu ý POST evidence dùng JWT status, xem review API. |
| T08–T10 | Blocked | HTTP suite posts không compile vì dependency chưa đủ; sau khi cài đúng chạy lại với DB/storage test cô lập và đủ ADMIN/status/biên. |
| T14–T15 full HTTP + DB | Blocked | Suite SQL chỉ kiểm repository, suite HTTP dùng fake; cần fixture console mail + DB test cô lập, oracle một user/phiên/ticket consume và đồng hồ kiểm thời gian. |
| T12 mở rộng: thiếu metadata, code lạ và điều kiện thành công | Not Run | Bổ sung test FE và thống nhất cách xử lý metadata/code lạ; kết quả T12 đã chạy chỉ gồm hai code 429. |
| T16 | Blocked | Chưa được cấp SMTP/hộp thư test; cần quyền, cấu hình và evidence gửi/nhận đã che. Không gửi thư thật. |
| UI admin, UI tạo tin, kiểm thử trình duyệt và FE–BE thật | Not Run | Chưa có fixture và môi trường tích hợp; cần xác nhận UI triển khai và chạy. |

CMP-37 chưa hoàn tất theo thông tin tiến độ mới; các nhãn Done trong handoff hoặc CMP-30 là thông tin lịch sử chưa được xác nhận lại. CMP-30 EX-17B/18B/19A và R01–R06 là bằng chứng lịch sử tại [báo cáo CMP-30](../CMP-30/Test_Execution_Report.md), không thay thế kết quả của phiên này. Review BE/FE/PM, PR và các bằng chứng trên còn thiếu; CMP-40 chưa Done.
