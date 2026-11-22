# Test cases CMP-40

Mỗi ca dùng dữ liệu giả; không lưu response có token, OTP, PII hay ảnh thẻ. API có prefix `/api/v1`. Trạng thái thực thi từng phần tại [report](Test_Execution_Report.md). P0 là an ninh/quyền, P1 chức năng. AC theo phạm vi CMP người giao, không đánh số AC chưa xác minh.

| ID | CMP / BDD | Ưu tiên | Tiền điều kiện và dữ liệu | Bước | Kết quả mong đợi |
|---|---|---|---|---|---|
| T01 | CMP-7 B01 | P0 | USER PENDING, ảnh giả JPG/PNG ≤10 MiB | POST multipart `school`, `studentCode`, `cardImage` hợp lệ; GET trạng thái và xem UI | 201, PENDING, giao diện chờ; không trả URL/ảnh |
| T02 | CMP-7 B02 | P0 | USER PENDING | Bỏ từng trường bắt buộc, gửi kiểu sai, vượt giới hạn, MIME sai, ảnh >10 MiB; guest gửi | 400 validation, 415 sai MIME, 413 quá lớn, 401 guest; không lưu hồ sơ sai |
| T03 | CMP-7/8 B02 | P0 | USER khác, ADMIN; storage thật test | Gọi danh sách/detail admin và thử truy cập ảnh; kiểm GET trạng thái/profile | USER 403; chỉ ADMIN có quyền xem, URL ngắn hạn hoạt động và hết hạn; profile không trả URL |
| T04 | CMP-7 B03 | P0 | USER PENDING; feed có tin ACTIVE và không ACTIVE | Gọi feed, search, chi tiết, post/chat trực tiếp, kiểm UI | Chỉ feed ACTIVE rút gọn, chặn search/detail/tương tác; nếu endpoint thiếu đánh Blocked |
| T05 | CMP-8 B04 | P0 | USER, guest, ADMIN; hồ sơ test | Gọi GET list/detail và PATCH quyết định bằng từng caller | 401 guest, 403 USER; ADMIN 200, chỉ dữ liệu được phép |
| T06 | CMP-8 B04 | P0 | hồ sơ PENDING | PATCH APPROVED; PATCH REJECTED với reason, thiếu/trắng và >500 ký tự trên fixture riêng; đọc status/notification/audit | approve APPROVED; reject REJECTED và có lý do; thiếu/trắng/quá dài 400; audit actor, target, action, thời gian, reason áp dụng |
| T07 | CMP-8 B05 | P0 | USER, JWT còn hạn, DB test | Giữ JWT PENDING, approve trong DB rồi POST; giữ JWT APPROVED, suspend rồi POST | 201 sau approve, 403 ACCOUNT_SUSPENDED sau suspend; không cần đổi JWT |
| T08 | CMP-9/10 B06 | P0 | guest, USER PENDING/APPROVED, ADMIN với status khác nhau | Với từng caller gọi POST trực tiếp mỗi loại tin | guest 401, PENDING USER 403, APPROVED 201, ADMIN không SUSPENDED được guard cho qua; ADMIN SUSPENDED 403; dữ liệu hợp lệ |
| T09 | CMP-9/10 B07 | P1 | category active; USER APPROVED | Tạo SELL với ảnh; BUY_REQUEST không ảnh; GET detail và me/posts | 201, ACTIVE, đúng owner/type/chi tiết; xem lại đúng; DB lưu đúng và không rò số điện thoại |
| T10 | CMP-9/10 B07 | P1 | USER APPROVED | Thiếu từng trường, title 255/256, price 0/0.01, budget âm/bằng/đảo, category sai, trường chéo, 0/1/5/6 ảnh, MIME sai/ảnh >10 MiB | 400 VALIDATION_FAILED cho dữ liệu sai; biên hợp lệ được chấp nhận; ảnh sai 415, quá lớn 413; BUY_REQUEST không bắt buộc ảnh |
| T11 | CMP-34 B08 | P0 | Nest harness cô lập, DB URL giả không hoạt động | GET health, kiểm response và log đã bắt | 200 degraded/disconnected, thông báo chung; không chứa cấu hình, tài khoản, mật khẩu, driver hay stack |
| T12 | CMP-35 B09/B13/B14 | P0 | FE test với transport/client mock | Với từng code 429, submit OTP; thử thiếu retry metadata, code lạ, OTP sai/hết hạn và verify thành công có ticket; kiểm alert, bước và payload | ATTEMPTS hướng dẫn xin mã mới khi được phép; RATE_LIMITED hướng dẫn chờ, không tự đặt thời gian; lỗi/OTP sai giữ password đóng, thành công có ticket mới chuyển bước; code lạ hiển thị lỗi chung an toàn |
| T13 | CMP-36 B10 | P1 | OpenAPI và JSON Schema validator | Validate item `{field,message}` và item có thêm thuộc tính | `{field,message}` được chấp nhận; `{field,message,extra}` bị từ chối |
| T14 | CMP-37 B11 | P0 | PostgreSQL test cô lập, ticket chưa consume | Đăng ký rồi replay; dùng ticket mới gửi 5 request đồng thời, đợi tất cả hoàn tất; đếm user, response session thành công và ticket active | đúng 1 đăng ký thành công, 1 session thành công, 1 user; replay từ chối, ticket đã consume/không còn hiệu lực; không chỉ dựa vào 409 trùng email |
| T15 | CMP-37 B12 | P0 | fixture thời gian và mail test double | Lấy ngưỡng N từ cấu hình test; thử trước/tại/sau hạn, attempts N−1/N/N+1, trước/sau cooldown, quota, resend và mã cũ | Theo cấu hình thực tế; mẫu 600s/5 lần/60s/5 mỗi giờ, mã cũ bị vô hiệu; mã mới verify thành công |
| T16 | CMP-37 B15 | P1 | SMTP test và hộp thư test được cấp phép | Xin OTP rồi đối chiếu luồng gửi/nhận mà không lưu mã | gửi/nhận thực và luồng OTP thành công; không gửi vào hộp thư tùy ý |
