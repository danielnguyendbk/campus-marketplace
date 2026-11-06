# Frontend Agent Guidelines - @campus/frontend

Tài liệu này là quy chuẩn bắt buộc dành cho mọi AI Agent và kỹ sư phát triển giao diện (Frontend) của Campus Marketplace.

---

## 1. Nguyên tắc làm việc với API Contract

1. **Tuân thủ tuyệt đối OpenAPI 3.x:**
   - Chỉ được gọi các endpoint đã được định nghĩa chính thức trong `packages/api-contract/openapi.yaml`.
   - **Tuyệt đối KHÔNG tự ý bịa endpoint mới** hoặc giả định các trường dữ liệu (field) không có trong schema.
   - Các trường trong JSON payload luôn tuân theo chuẩn `camelCase` theo quy ước OpenAPI của dự án.

2. **Sử dụng Typed API Client:**
   - Mọi request HTTP phải thông qua service layer tập trung (`src/services/api.ts`).
   - Khai báo rõ ràng Interface cho Request parameters, Request Body và Response Data.
   - Tuyệt đối không hard-code URL backend trong component; sử dụng biến môi trường `NEXT_PUBLIC_API_BASE_URL`.

3. **Cơ chế Mock API:**
   - Khi Backend chưa hoàn thành endpoint nghiệp vụ tương ứng, Frontend Agent được phép sử dụng Mock Server của Apidog hoặc mock data adapter nội bộ có cấu trúc khớp 100% với schema OpenAPI.
   - Khi backend sẵn sàng, việc chuyển đổi chỉ cần thay đổi Base URL sang Backend thật.

4. **Tuyệt đối KHÔNG truy cập CSDL trực tiếp:**
   - Frontend không được phép kết nối trực tiếp đến PostgreSQL / Supabase connection string. Mọi tương tác dữ liệu phải thông qua NestJS Backend REST API.

---

## 2. Tiêu chuẩn trải nghiệm người dùng (UX States)

Mọi màn hình hoặc component gọi API **bắt buộc** phải xử lý trọn vẹn 5 trạng thái:

1. **Loading State:** Hiển thị skeleton / spinner chỉ báo trong lúc tải dữ liệu.
2. **Empty State:** Hiển thị hình ảnh hoặc thông báo thân thiện khi không có dữ liệu (ví dụ: "Chưa có bài đăng nào trong danh mục này").
3. **Error State:** Bắt lỗi mạng hoặc lỗi 5xx từ server và hiển thị thông báo lỗi rõ ràng cho người dùng kèm nút thử lại (Retry).
4. **Unauthorized State (401):** Điều hướng người dùng về trang Đăng nhập khi token hết hạn hoặc chưa đăng nhập.
5. **Forbidden State (403):** Thông báo tài khoản chưa được xác thực thẻ sinh viên (`verification_status !== 'APPROVED'`) khi cố gắng đăng bài bán hoặc nhắn tin.

---

## 3. Ranh giới trách nhiệm (Boundaries)

- Frontend Agent **chỉ làm việc bên trong thư mục `apps/frontend/`**.
- Không tự ý sửa đổi code của Backend (`apps/backend/`) hay cấu trúc database (`database/`).
- Nếu giao diện cần thêm dữ liệu mà API hiện tại chưa hỗ trợ, hãy mở Issue đề xuất cập nhật OpenAPI Contract và thông báo cho Backend Lead.
