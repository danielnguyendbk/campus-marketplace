# @campus/api-contract

Gói hợp đồng API cho hệ thống **Campus Marketplace** (OpenAPI 3.x, phiên bản v1.2.0-draft).

## 1. Thông tin hợp đồng

- **Phiên bản:** `v1.2.0-draft`
- **Chuẩn:** OpenAPI 3.0.3
- **File định nghĩa:** `openapi.yaml`
- **Số endpoint:** 49 endpoints (bao gồm 35 endpoints cốt lõi và 14 endpoints đề xuất mở rộng `x-source: Proposed extension` cần nhóm phê duyệt).
- **Base URL:** `/api/v1`

## 2. Quy tắc quan trọng

1. **Source of Truth:** Hợp đồng được đồng bộ hai chiều với Apidog. Mọi thay đổi phải qua thảo luận nhóm và cập nhật OpenAPI spec trước khi triển khai code.
2. **Frontend Agent:**
   - Chỉ sử dụng các endpoint và thuộc tính đã được đặc tả trong `openapi.yaml`.
   - Không tự ý bịa endpoint mới hoặc response field không có trong tài liệu.
   - Khi Backend chưa hoàn thành, sử dụng tính năng Mock của Apidog hoặc mock adapter nội bộ dựa trên schema OpenAPI này.
3. **Backend Agent:**
   - Implement đúng request payload, response status code, header và body structure theo OpenAPI.
   - Không đơn phương thay đổi contract nếu chưa qua review và thống nhất với Tech Lead / Frontend Lead.
   - Enforce chặt chẽ Authentication, Authorization (Role, VerificationStatus) và validation ở phía Server.

## 3. Cách sử dụng

```typescript
import { OPENAPI_SPEC_PATH, API_CONTRACT_METADATA } from '@campus/api-contract';

console.log(API_CONTRACT_METADATA.title); // Campus Marketplace API
```
