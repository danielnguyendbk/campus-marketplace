# Frontend - Backend Integration Guide

Tài liệu hướng dẫn chuẩn hóa tích hợp API giữa Frontend (`apps/frontend`) và Backend NestJS (`apps/backend`) cho hệ thống Campus Marketplace.

---

## 1. Chuẩn hóa Response Envelope

Backend áp dụng kiến trúc **Response Envelope** đồng nhất thông qua `TransformInterceptor` và `HttpExceptionFilter`. Toàn bộ dữ liệu trả về từ API đều được bọc trong cấu trúc chuẩn.

### 1.1. Cấu trúc Thành công (Success Envelope)

Mọi HTTP Status `2xx` đều tuân thủ kiến trúc Success Envelope chuẩn OpenAPI v1.2 (`additionalProperties: false`):

#### 1. Phản hồi thực thể đơn (Single Entity Response):
Áp dụng cho các endpoint trả về một thực thể (ví dụ: `GET /me`, `POST /auth/login`, `GET /posts/{id}`):

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

#### 2. Phản hồi phân trang (Paginated Page Response - Root-level Data & Meta):
Áp dụng cho tất cả endpoint danh sách (ví dụ: `GET /categories`, `GET /posts`, `GET /feed`, `GET /me/reports`, `GET /admin/users`):

```typescript
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginatedEnvelope<T> {
  success: true;
  data: T[];
  meta: PageMeta;
  timestamp: string; // ISO 8601 string
}
```

> [!IMPORTANT]
> **Quy tắc phân trang chuẩn OpenAPI v1.2 (Root-level `data` và `meta`):**
> Trong các phản hồi phân trang, `data` (mảng các thực thể) và `meta` (`PageMeta`) nằm cùng cấp ở root bên cạnh `success: true` và `timestamp`. Tuyệt đối **KHÔNG** tạo cấu trúc lồng `data: { data, meta }`. Cả hai dạng phản hồi đều áp dụng ràng buộc nghiêm ngặt `additionalProperties: false`.

### 1.2. Cấu trúc Lỗi (Error Envelope) - Tuân thủ nghiêm ngặt OpenAPI v1.2

Mọi HTTP Status `4xx` và `5xx` đều được chuẩn hóa qua `AllExceptionsFilter` (`apps/backend/src/common/filters/http-exception.filter.ts`) tuân thủ tuyệt đối schema `ErrorEnvelope` trong OpenAPI v1.2 (`packages/api-contract/openapi.yaml`), với ràng buộc nghiêm ngặt `additionalProperties: false`:

```typescript
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;       // Mã lỗi chuẩn (ví dụ: 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_FAILED', 'INTERNAL_SERVER_ERROR')
  message: string;    // Thông điệp người dùng thân thiện, an toàn
  details?: ApiErrorDetail[]; // Danh sách lỗi xác thực chi tiết (nếu có)
}

export interface ErrorEnvelope {
  error: ApiErrorPayload; // Đối tượng lỗi chi tiết (BẮT BUỘC)
  requestId?: string;     // Correlation ID từ x-request-id header (TÙY CHỌN)
}
```

> [!IMPORTANT]
> **Chuẩn thống nhất OpenAPI v1.2 (Strict Contract Adherence):**
> 1. Top-level body của phản hồi lỗi **CHỈ CHỨA DUY NHẤT** 2 trường: `error` (bắt buộc) và `requestId` (tùy chọn khi client gửi `x-request-id`).
> 2. Tuyệt đối **KHÔNG** chứa các trường thừa ở top-level như `success`, `statusCode`, `message`, `timestamp`, `path` do schema OpenAPI đã ấn định `additionalProperties: false`.
> 3. Mã HTTP Status được gửi nguyên bản qua HTTP Response Status Header (ví dụ: `HTTP/1.1 403 Forbidden`, `HTTP/1.1 500 Internal Server Error`).

**Ví dụ JSON lỗi 403 Forbidden (Tài khoản PENDING cố truy cập bài đăng chi tiết):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Tài khoản của bạn đang chờ phê duyệt thẻ sinh viên. Vui lòng quay lại sau."
  },
  "requestId": "req-98765"
}
```

**Ví dụ JSON lỗi 400 Bad Request (Lỗi validation dữ liệu đầu vào):**
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "title must not be empty, price must be positive",
    "details": [
      { "field": "title", "message": "title must not be empty" },
      { "field": "price", "message": "price must be positive" }
    ]
  },
  "requestId": "req-12345"
}
```

### 1.3. Chỉ thị Bảo mật An toàn cho Lỗi Máy chủ (HTTP 500 - Security Directive)

Khi hệ thống phát sinh lỗi không mong muốn không phải là `HttpException` (ví dụ: lỗi kết nối PostgreSQL, lỗi cú pháp truy vấn SQL, lỗi runtime `TypeError` / `NullPointerException`):

1. **Thông điệp công khai an toàn (Safe Public Message):**
   - Phản hồi trả về client bắt buộc mang mã `500 Internal Server Error`.
   - `error.code` luôn là `"INTERNAL_SERVER_ERROR"`.
   - `error.message` luôn là `"Internal server error"`.
   - `error.details` luôn là `undefined` (không trả về).
2. **Tuyệt đối không rò rỉ dữ liệu nhạy cảm:**
   - Nghiêm cấm đưa `exception.message`, connection string (`DATABASE_URL`, mật khẩu CSDL), tên bảng, tên cột SQL hoặc stack trace vào JSON phản hồi.
   - Toàn bộ thông tin chi tiết lỗi và stack trace chỉ được ghi nhận vào **Server Logs** (`this.logger.error(...)`) để kỹ sư DevOps/Backend phân tích.

**Ví dụ JSON phản hồi an toàn khi có lỗi cơ sở dữ liệu hoặc crash runtime:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Internal server error"
  },
  "requestId": "req-crash-safe-001"
}
```

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

## 3. Chuẩn phân trang (Pagination Envelope - Root Level)

Dữ liệu danh sách (Categories, Posts, Feed, Messages, Reports, Admin Users, v.v.) tuân thủ tuyệt đối OpenAPI Contract v1.2 (Phương án 1): `data` và `meta` nằm cùng cấp ở root bên cạnh `success` và `timestamp`, tuyệt đối **KHÔNG** lồng `data: { data, meta }`.

```typescript
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginatedEnvelope<T> {
  success: true;
  data: T[];
  meta: PageMeta;
  timestamp: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PageMeta;
}
```

**Ví dụ JSON thực tế (`PostPage` / `GET /posts`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "a23ef463-1a6b-4b2d-a330-0e47edff0217",
      "postType": "SELL",
      "title": "Giáo trình Java còn mới",
      "categoryId": "TEXTBOOK",
      "province": "TP. Hồ Chí Minh",
      "status": "ACTIVE",
      "price": 120000,
      "thumbnailUrl": "https://example.com/mock/post-images/java-book.jpg",
      "createdAt": "2026-11-01T09:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "timestamp": "2026-11-03T06:30:00.000Z"
}
```

### Sử dụng ở Frontend Client (`requestPaginated`):
```typescript
// Component gọi qua ApiClient đã bóc tách dữ liệu danh sách và metadata phân trang
const { data, meta } = await apiClient.requestPaginated<PostSummary>('/posts?page=1&limit=20');
console.log(data);       // PostSummary[]
console.log(meta.total); // 45
console.log(meta.page);  // 1
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

