# Campus Marketplace API Documentation

## 1. Thông tin tổng quan

- **Tiêu chuẩn:** OpenAPI 3.0.3
- **Tệp định nghĩa:** `Campus_Marketplace_OpenAPI_v1.2.yaml` (hoặc gói `@campus/api-contract`)
- **Số endpoint:** 49 endpoints
  - 35 endpoints chuẩn đã được định nghĩa theo hồ sơ nghiệp vụ v1.2
  - 14 endpoints đề xuất mở rộng gắn nhãn `x-source: Proposed extension` (đang chờ phê duyệt của nhóm trước khi bắt đầu code)
- **Base URL:** `/api/v1`

## 2. Apidog Integration

- File OpenAPI `Campus_Marketplace_OpenAPI_v1.2.yaml` là file gốc đồng bộ trực tiếp với project Apidog của nhóm.
- Môi trường Mock Server được bật trên Apidog để đội Frontend có thể tích hợp và kiểm thử giao diện ngay cả khi Backend chưa hoàn tất endpoint tương ứng.
- Tuyệt đối không thay đổi schema trường trong YAML mà chưa thông qua thảo luận nhóm.
