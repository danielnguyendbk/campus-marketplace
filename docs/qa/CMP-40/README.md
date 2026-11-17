# CMP-40 — Đặc tả và hướng dẫn nghiệm thu

Bộ tài liệu quy định hành vi và điều kiện nghiệm thu cho xác minh sinh viên, phân quyền, tạo tin và các kiểm tra CMP-34–37. Trạng thái triển khai ticket không thay thế kết quả kiểm thử hay phê duyệt.

| Ticket | Tiến độ do người giao xác nhận | Phạm vi tiếp theo |
|---|---|---|
| CMP-7, CMP-8, CMP-9, CMP-10 | Dev đã triển khai | Đối chiếu chênh lệch, kiểm thử tích hợp và nghiệm thu |
| CMP-34, CMP-36 | Dev đã triển khai | Bổ sung bằng chứng ở phạm vi còn thiếu và review contract |
| CMP-35 | Chưa triển khai | FE triển khai phân biệt lỗi OTP và nghiệm thu |
| CMP-37 | Chưa hoàn tất | BE/BA phối hợp kiểm chứng ticket OTP và các ca biên |

## Mục lục

- [Hướng dẫn triển khai và nghiệm thu](Implementation_Guide.md): quy định, API và checklist theo CMP.
- [BDD](BDD.feature) và [test cases](Test_Cases.md): kịch bản và dữ liệu kiểm thử.
- [Ma trận truy vết](Traceability_Matrix.md): nguồn, hướng dẫn, ca và bằng chứng.
- [Cần xác nhận về contract](API_Contract_Review.md): chênh lệch và quyết định còn mở.
- [Báo cáo thực thi](Test_Execution_Report.md): kết quả thật, giới hạn và sự cố DB; [evidence](evidence/README.md) chứa script tái hiện đã làm sạch.

## Điều kiện hoàn thành CMP-40

- [ ] BE/FE thực hiện CMP-35; BE/BA hoàn tất kiểm chứng CMP-37 theo oracle đã thống nhất.
- [ ] Thực hiện các ca Blocked/Not Run với DB và storage test riêng, UI–API thật và SMTP được cấp phép; xử lý các kết quả không đạt.
- [ ] BE/FE/PM xác nhận các điểm mở, bao gồm quyền với JWT cũ, ảnh thẻ, health contract và phạm vi feed/search.
- [ ] Quản trị DB kiểm tra audit/backup để xác định ảnh hưởng sự cố schema trong [báo cáo](Test_Execution_Report.md#sự-cố-chạy-ngoài-phạm-vi-db-dự-kiến).
- [ ] Hoàn tất kiểm tra chất lượng và review/PR theo quy trình dự án; không tự ghi nhận phê duyệt.

## Điều kiện an toàn khi tái hiện

Chỉ dùng dữ liệu giả. Không lưu OTP, ticket, token, password, PII, ảnh thật hay log nhạy cảm. **Dừng trước khi chạy** mọi test có thể tạo, thay đổi hoặc xóa DB/schema nếu chưa xác nhận được DB test riêng, quyền và phạm vi xóa. Xác minh đích kết nối và schema bằng phương pháp đã được quản trị viên môi trường chấp thuận; xác nhận schema `cmp37_isolated_test` không có dữ liệu cần giữ vì test sẽ `DROP ... CASCADE`. Chỉ sau đó mới chỉ định rõ cấu hình DB test; không để test tự nạp `.env` hoặc DB dùng chung. Hướng dẫn này là điều kiện vận hành thủ công, không khẳng định test hiện có tự chặn thực thi.

Test schema có thể chạy bằng `node docs/qa/CMP-40/evidence/schema-check.cjs`; health harness bằng `node docs/qa/CMP-40/evidence/health-check.cjs` với quyền loopback, DB URL giả tại cổng 1. Cách chạy UI mock và phụ thuộc script xem [evidence](evidence/README.md). SMTP thật chỉ dùng hộp thư test được cấp phép. Không chạy lại E2E/DB trong lần chỉnh tài liệu này.
