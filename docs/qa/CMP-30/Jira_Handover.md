# Bàn giao Jira CMP-30 — bản nháp chờ review

## Nội dung bình luận để dán vào Jira

> Đã chuẩn bị bộ tài liệu BA cho CMP-6: BDD Gherkin, test case chi tiết, ma trận truy vết và danh sách điểm cần xác nhận. Bộ bao phủ email hợp lệ/ngoài allowlist/trùng; OTP đúng/sai/hết hạn/vượt lần; chặn password và phiên khi chưa verify; đăng ký PENDING; login đúng/sai; kiểm tra quyền theo trạng thái và khách chưa đăng nhập. Có ca API trực tiếp để kiểm soát backend. Thông số cấu hình và quy tắc đã được cụ thể hóa; sai khác và phụ thuộc còn lại được ghi R01–R06.
>
> Nhờ BE, FE và PM/BA review R01–R06 trong README: thứ tự nhập tên, diễn đạt AT-01/PENDING, giới hạn password, ticket một lần, domain gốc và endpoint/thông điệp 429. AT-01 phần nộp hồ sơ/ảnh chưa thuộc bộ auth này. Đã thực thi một phần trên PostgreSQL local và mail console; xem Test_Execution_Report.md để biết từng ca, giới hạn SMTP và các ca Blocked/Not Run. Chưa có xác nhận review và chưa đề nghị chuyển Done.
>
> Đề xuất cỡ **M tạm thời**, chưa quy đổi SP/thời gian: nhiều nhánh auth và phối hợp ba vai trò, có phụ thuộc xác nhận; phân cỡ cho công việc BA theo DoD gốc, không quy đổi story point hay thời gian; phiên kiểm thử local bổ sung được ghi riêng. Nhóm vui lòng đối chiếu thang cỡ của mình.

## File đính kèm hoặc link nhóm

- `docs/qa/CMP-30/README.md`
- `docs/qa/CMP-30/CMP-6-auth.feature`
- `docs/qa/CMP-30/Test_Cases.md`
- `docs/qa/CMP-30/Traceability_Matrix.md`
- `docs/qa/CMP-30/Jira_Handover.md`
- `docs/qa/CMP-30/Test_Execution_Report.md`

Nếu đính kèm file rời, gửi cả sáu file và bằng chứng `evidence/UI_2026-11-15.md`, `evidence/ui-round3/`; đường dẫn tương đối dẫn tới source repo chỉ hoạt động khi người review có repository. Hồ sơ v1.2 nằm ngoài repo, chia sẻ theo quyền của nhóm, không đính kèm thông tin nhạy cảm.

## Checklist review

- [ ] BA/PM đối chiếu sai khác R01–R06 và chốt người chịu trách nhiệm review.
- [ ] BE xác nhận allowlist, so trùng, endpoint, response, OTP, ticket, quyền và cách tạo fixture an toàn.
- [ ] FE xác nhận thứ tự nhập tên, validation, thông báo và hiển thị trạng thái.
- [ ] QA xác nhận dữ liệu/công cụ test, phạm vi AT-01 và oracle từng ca.
- [ ] Cập nhật BDD/test case nếu review dẫn tới thay đổi được phê duyệt.
- [ ] Gắn tài liệu hoặc link được cấp quyền vào CMP-30, đăng bình luận và mời review.

## Checklist DoD

- [x] Thiết kế bao phủ các nhóm email, OTP, chặn password, login và PENDING.
- [x] Truy vết FR-01/BR-01/02/AT-01 và toàn bộ AC; chỉ rõ AT-01 phần ngoài phạm vi.
- [ ] BE/FE thống nhất và có người xác nhận bằng chứng review.
- [ ] Tài liệu được lưu vào nơi nhóm cùng truy cập hoặc đính kèm Jira.

## Xác nhận

| Vai trò | Tên | Ngày | Kết quả / link bằng chứng |
|---|---|---|---|
| BA/PM | Chưa xác nhận | — | — |
| BE | Chưa xác nhận | — | — |
| FE | Chưa xác nhận | — | — |
| QA | Chưa xác nhận | — | — |

Không tự cập nhật trạng thái Jira; người phụ trách quyết định sau khi review và đáp ứng DoD.

## Bổ sung cho bình luận Jira sau phiên thực thi

> Đã chạy trên commit `00494ba316d37218bd2f903546141085b35f7739` với DB PostgreSQL local và mail console: 35 Pass, 0 Fail, 8 Blocked, 0 Not Run trên 43 ca con. OTP đúng/sai/hết hạn/vượt ngưỡng thử nghiệm, chặn ticket giả/thiếu và login PENDING đã có bằng chứng API; UI đăng ký, email không tồn tại và xác nhận mật khẩu không khớp đã kiểm qua Playwright; UI guest chuyển login nhưng xác thực server vẫn Blocked do endpoint chưa có. SMTP thực chưa kiểm. `/feed` và `/posts/{id}` trả 404 nên chưa kiểm được quyền; UI PENDING báo lỗi feed (DEF-CMP30-01, đã có ghi nhận lịch sử). Nhờ BE/FE/PM review R01–R06 và ghi xác nhận bàn giao; chưa đề nghị Done.
