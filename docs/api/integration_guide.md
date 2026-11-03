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

Mọi HTTP Status `4xx` và `5xx` đều được chuẩn hóa qua `HttpExceptionFilter`:

```typescript
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;       // Mã lỗi chuẩn (ví dụ: 'UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_FAILED')
    message: string;    // Thông điệp người dùng thân thiện
    details?: ApiErrorDetail[]; // Danh sách lỗi xác thực chi tiết (nếu có)
  };
  timestamp: string;
}
```

**Ví dụ JSON lỗi 403 Forbidden (Tài khoản PENDING cố truy cập bài đăng chi tiết):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Tài khoản của bạn đang chờ phê duyệt thẻ sinh viên. Vui lòng quay lại sau."
  },
  "timestamp": "2026-11-03T06:30:00.000Z"
}
```

---

## 2. Chuẩn Client-side Unwrapping (Frontend SDK)

Để đảm bảo Frontend Developer dễ dàng thao tác với kiểu dữ liệu sạch mà không phải bóc tách thủ công `.data` ở từng component, `ApiClient` (`apps/frontend/src/services/api.ts`) tự động unwrap payload.

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

    const payload = await response.json();

    if (!response.ok) {
      const errorMessage = payload?.error?.message || payload?.message || `HTTP ${response.status}: Request failed`;
      const errorCode = payload?.error?.code || 'UNKNOWN_ERROR';
      throw new ApiError(errorMessage, response.status, errorCode, payload?.error?.details);
    }

    // Tự động unwrap nếu có bọc envelope
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return (payload as ApiEnvelope<T>).data;
    }

    return payload as T;
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
- Khi Access Token hết hạn (thường sau 15 phút), Client gửi Refresh Token qua `POST /auth/refresh` để nhận cặp token mới.
- Lấy thông tin người dùng hiện tại qua endpoint chuẩn: `GET /me` (Lưu ý: Không dùng `/profile/me`).
- Đối với tài khoản `PENDING`:
  - Cho phép gọi `GET /feed` (nhận danh sách tóm tắt `PendingFeedPage` không có thông tin liên lạc người bán).
  - Nghiêm cấm gọi `GET /posts/{id}` (trả về `403 Forbidden`).
