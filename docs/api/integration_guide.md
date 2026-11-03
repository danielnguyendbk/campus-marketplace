# Frontend - Backend Integration Guide

Tài liệu hướng dẫn chuẩn hóa tích hợp API giữa Frontend (`apps/frontend`) và Backend NestJS (`apps/backend`) cho hệ thống Campus Marketplace.

---

## 1. Chuẩn hóa Response Envelope

Backend áp dụng kiến trúc **Response Envelope** đồng nhất thông qua `TransformInterceptor` và `HttpExceptionFilter`. Toàn bộ dữ liệu trả về từ API đều được bọc trong cấu trúc chuẩn.

### 1.1. Cấu trúc Thành công (Success Envelope)

Mọi HTTP Status `2xx` đều tuân thủ cấu trúc:

```typescript
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string; // ISO 8601 string, ví dụ: '2026-11-03T06:30:00.000Z'
}
```

**Ví dụ JSON thực tế (Health check):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-11-03T06:30:00.000Z",
    "uptime": 12.34,
    "environment": "development",
    "database": {
      "status": "connected",
      "version": "PostgreSQL 15.8 (Supabase Pooler)",
      "latencyMs": 45
    }
  },
  "timestamp": "2026-11-03T06:30:00.000Z"
}
```

### 1.2. Cấu trúc Lỗi (Error Envelope)

Mọi HTTP Status `4xx` và `5xx` đều được chuẩn hóa qua `AllExceptionsFilter` (`apps/backend/src/common/filters/http-exception.filter.ts`):

```typescript
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;       // Mã lỗi chuẩn (ví dụ: 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_FAILED')
  message: string;    // Thông điệp người dùng thân thiện
  details?: ApiErrorDetail[]; // Danh sách lỗi xác thực chi tiết (nếu có)
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;    // Thông điệp cấp cao
  error: ApiErrorPayload; // Đối tượng lỗi chi tiết tương thích OpenAPI
  timestamp: string;  // ISO 8601 UTC
  path: string;       // Request URL
  requestId?: string; // Request Correlation ID
}
```

**Ví dụ JSON lỗi 403 Forbidden (Tài khoản PENDING cố truy cập bài đăng chi tiết):**
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Tài khoản của bạn đang chờ phê duyệt thẻ sinh viên. Vui lòng quay lại sau.",
  "error": {
    "code": "FORBIDDEN",
    "message": "Tài khoản của bạn đang chờ phê duyệt thẻ sinh viên. Vui lòng quay lại sau."
  },
  "timestamp": "2026-11-03T06:30:00.000Z",
  "path": "/api/v1/posts/123e4567-e89b-12d3-a456-426614174000"
}
```

**Ví dụ JSON lỗi 400 Bad Request (Lỗi validation dữ liệu đầu vào):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "title must not be empty, price must be positive",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "title must not be empty, price must be positive",
    "details": [
      { "field": "title", "message": "title must not be empty" },
      { "field": "price", "message": "price must be positive" }
    ]
  },
  "timestamp": "2026-11-03T06:30:00.000Z",
  "path": "/api/v1/posts"
}
```

### 1.3. Báo cáo Đồng bộ Hóa & Contract Mismatch Analysis với OpenAPI v1.2

- **Đặc tả OpenAPI (`packages/api-contract/openapi.yaml`):**
  Trong baseline contract, schema `ErrorEnvelope` được định nghĩa sơ khởi như sau:
  ```yaml
  ErrorEnvelope:
    type: object
    properties:
      error:
        type: object
        properties:
          code: { type: string }
          message: { type: string }
          details: { type: array, items: { type: object, properties: { field: { type: string }, message: { type: string } } } }
        required: [code, message]
      requestId: { type: string }
    required: [error]
    description: "Dạng lỗi đề xuất, FE/BE phải chốt trước khi triển khai."
  ```
- **Thực tế Triển khai Hệ thống (NestJS Backend + React Frontend):**
  Để bảo đảm tính đối xứng và nhất quán toàn diện với Success Envelope `{ success: true, data, timestamp }`, hệ thống chuẩn hóa tầng nền tảng như sau:
  1. Trường `error` trong phản hồi HTTP lỗi luôn là một object có `{ code, message, details? }`, hoàn toàn khớp 100% với schema `error` trong OpenAPI.
  2. Bổ sung các metadata bao bọc cấp hệ thống: `success: false`, `statusCode`, `timestamp`, `path`, và `requestId`.
  3. Frontend `ApiClient` kiểm tra cả `error.code` và `error.message` lồng nhau để ném `ApiError` chuẩn hóa, không còn bị phụ thuộc vào định dạng phẳng cũ.
- **Kết luận:** API Contract được tôn trọng tối đa (không tự tiện sửa schema contract gốc khi chưa qua phê duyệt change request), đồng thời tầng triển khai tài liệu hóa rõ ràng phần mở rộng đối xứng này.

---

## 2. Chuẩn Client-side Unwrapping (Frontend SDK)

Để đảm bảo Frontend Developer dễ dàng thao tác với kiểu dữ liệu sạch mà không phải bóc tách thủ công `.data` ở từng component, `ApiClient` (`apps/frontend/src/services/api.ts`) tự động unwrap payload. **Bắt buộc phản hồi thành công phải tuân thủ nghiêm ngặt `{ success: true, data, timestamp }`**, nếu không hệ thống sẽ ném lỗi `ApiError` với mã `INVALID_RESPONSE_ENVELOPE` hoặc `INVALID_JSON`, tuyệt đối không fallback trả dữ liệu dạng phẳng hay trả về `null`.

### Triển khai chuẩn trong `ApiClient`:

```typescript
// apps/frontend/src/services/api.ts
export class ApiClient {
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError(`HTTP error ${response.status}: ${response.statusText}`, response.status, 'HTTP_ERROR');
      }
      throw new ApiError('Invalid JSON response from server', response.status, 'INVALID_JSON');
    }

    if (!response.ok) {
      const errPayload = payload as {
        error?: { code?: string; message?: string; details?: ApiErrorDetail[] } | string;
        message?: string;
      };
      const errorMessage =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.message : undefined) ||
        errPayload?.message ||
        `HTTP error ${response.status}: ${response.statusText}`;
      const errorCode =
        (typeof errPayload?.error === 'object' ? errPayload?.error?.code : undefined) ||
        (typeof errPayload?.error === 'string' ? errPayload?.error : undefined) ||
        'REQUEST_FAILED';
      const details = typeof errPayload?.error === 'object' ? errPayload?.error?.details : undefined;
      throw new ApiError(errorMessage, response.status, errorCode, details);
    }

    // Nghiêm ngặt kiểm tra cấu trúc envelope
    const isEnvelope =
      Boolean(payload) &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).success === true &&
      'data' in (payload as Record<string, unknown>) &&
      typeof (payload as Record<string, unknown>).timestamp === 'string';

    if (!isEnvelope) {
      throw new ApiError(
        'Invalid response envelope: response must adhere to { success: true, data, timestamp }',
        response.status,
        'INVALID_RESPONSE_ENVELOPE',
      );
    }

    return (payload as ApiEnvelope<T>).data;
  }
}
```

### Sử dụng ở Component hoặc Custom Hook:

```typescript
// Component nhận trực tiếp T sạch đã bóc tách
const health: HealthResponse = await apiClient.getHealth();
console.log(health.status); // "ok"
console.log(health.database.status); // "connected"
```

Nếu một số trường hợp component cần lấy toàn bộ metadata của envelope (bao gồm `timestamp` hoặc header):
```typescript
const fullResponse: ApiEnvelope<HealthResponse> = await apiClient.getRawHealth();
console.log(fullResponse.timestamp);
```

---

## 3. Chuẩn phân trang (Pagination Envelope)

Dữ liệu danh sách (Feed, Tìm kiếm, Lịch sử giao dịch) luôn sử dụng cấu trúc phân trang đồng nhất:

```typescript
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

Trong envelope, cấu trúc phản hồi sẽ là:
```json
{
  "success": true,
  "data": {
    "items": [ /* Danh sách thực thể */ ],
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "timestamp": "2026-11-03T06:30:00.000Z"
}
```

---

## 4. Xác thực và Phân quyền (Authentication Headers)

- **Header chuẩn:** `Authorization: Bearer <access_token>`
- Token lấy từ endpoint `POST /auth/login` hoặc `POST /auth/verify-otp`.
- Khi Access Token hết hạn (thường sau 15 phút), Client gửi Refresh Token qua `[Đề xuất mở rộng: POST /auth/refresh (Chưa có trong OpenAPI v1.2 baseline; Phase 1 sử dụng Access Token kết hợp đăng nhập lại)]` để nhận cặp token mới.
- Lấy thông tin người dùng hiện tại qua endpoint chuẩn: `GET /me` (Lưu ý: Không dùng `/profile/me`).
- Đối với tài khoản `PENDING`:
  - Cho phép gọi `GET /feed` (nhận danh sách tóm tắt `PendingFeedPage` không có thông tin liên lạc người bán).
  - Nghiêm cấm gọi `GET /posts/{id}` (trả về `403 Forbidden`).

