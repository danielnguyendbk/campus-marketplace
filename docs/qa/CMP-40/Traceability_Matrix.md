# Truy vết CMP-40

Nguồn: [hồ sơ v1.2](../../../../Ho_so_nghiep_vu_Campus_Marketplace_v1.2.docx) §4–5; [OpenAPI](../../../packages/api-contract/openapi.yaml); [CMP-30](../CMP-30/README.md), [báo cáo EX-17B/18B/19A](../CMP-30/Test_Execution_Report.md); [BE](../../../apps/backend/src/modules/), [guard](../../../apps/backend/src/common/auth/) và [FE](../../../apps/frontend/src/features/). Commit kiểm thử `8f450ce589f1a4bbaf173d791fccfa14a01511a2`; không suy ra mã AC. Kết quả trong [report](Test_Execution_Report.md) chỉ bao phủ phần được nêu. Tiến độ CMP-35/37 chưa hoàn tất theo người giao, không coi kết quả bản hiện tại là nghiệm thu ticket.

Hướng dẫn cho từng dòng tương ứng mục CMP trong [Implementation Guide](Implementation_Guide.md).

| Nguồn / yêu cầu | BDD | Ca | Kết quả / bằng chứng |
|---|---|---|---|
| CMP-7, FR-02, BR-03 | B01–B02 | T01–T03 | HTTP mock và UI mock Pass một phần; storage thật/truy cập URL Blocked |
| CMP-7, FR-04, BR-04 | B03 | T04 | UI mock Pass một phần; feed/search server Blocked, detail trực tiếp Not Run |
| CMP-8, FR-03, BR-03 | B04 | T05–T06 | HTTP với repository giả Pass một phần; audit DB/notification thực Blocked |
| CMP-8, BR-04 | B05 | T07 | Guard unit mock Pass một phần; vòng đời JWT + DB thật Blocked |
| CMP-9/10, FR-06/07, BR-04/05 | B06–B07 | T08–T10 | Suite HTTP posts không biên dịch do dependency; Not Run |
| CMP-34 | B08 | T11 | Pass HTTP harness DB giả; log chỉ kiểm điều kiện được mô tả |
| CMP-35 | B09/B13/B14 | T12 | Mock bản hiện tại: Fail ATTEMPTS, Pass RATE_LIMITED; thiếu metadata/code lạ và điều kiện thành công chưa nghiệm thu |
| CMP-36 | B10 | T13 | Pass validator Ajv đối với item schema |
| CMP-37, BR-01 | B11–B12/B15 | T14–T16 | Repository DB tạm 7/7 và auth HTTP fake Pass một phần; API+DB, số phiên và SMTP Blocked |
