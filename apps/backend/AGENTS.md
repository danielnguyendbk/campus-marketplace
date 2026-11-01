# Backend Agent Guidelines - @campus/backend

Tài liệu này là quy chuẩn bắt buộc dành cho mọi AI Agent và kỹ sư phát triển Backend của Campus Marketplace.

---

## 1. Tuân thủ Nghiệp vụ & Kiến trúc Hệ thống

1. **Chuẩn nghiệp vụ:**
   - Triển khai chính xác logic kinh doanh theo **Hồ sơ Campus Marketplace v1.2** (`docs/business-rules/README.md`).
   - Không tự ý thêm bớt các quy tắc ngoài phạm vi thiết kế.

2. **Cấu trúc Modular Monolith & Luồng 3 tầng (Layered Architecture):**
   - Mọi chức năng nghiệp vụ phải thuộc về một Domain Module cụ thể đặt trong `src/modules/<tên-module>/`.
   - **Luồng dữ liệu bắt buộc:**
     $$\text{Client} \longrightarrow \text{Controller} \longrightarrow \text{Service} \longrightarrow \text{Repository} \longrightarrow \text{PostgreSQL Pool (pg)}$$
   - **Controller:** Chỉ định tuyến, nhận DTO, gọi Guard/Pipe và chuyển việc cho Service. Không viết SQL hoặc business logic tại Controller.
   - **Service:** Xử lý nghiệp vụ, điều phối nhiều Repository, quản lý Database Transaction khi ghi dữ liệu nhiều bảng liên quan.
   - **Repository Layer:** Sử dụng thư viện `pg` (SQL-first), viết SQL tường minh, map dữ liệu thô sang entity có kiểu. Không tạo N+1 query.

3. **Validation & Authorization ở phía Server:**
   - Mọi payload đầu vào phải được kiểm tra qua `ValidationPipe` và class-validator DTO.
   - Enforce chặt chẽ quyền hạn: Kiểm tra Role (`USER`, `ADMIN`) và `verification_status` (`APPROVED` mới được đăng tin bán hoặc chat). Không dựa vào Frontend để bảo vệ dữ liệu.

---

## 2. Quản lý Database & Migration

1. **Tuyệt đối không tự tạo bảng ngoài quy trình migration:**
   - Cơ sở dữ liệu baseline gồm 18 bảng đã được chốt tại `database/baseline/schema_v1.2.sql`.
   - Nếu cần thay đổi cấu trúc bảng, BẮT BUỘC viết file SQL migration trong `database/migrations/` và tạo PR riêng.
   - Backend không được dùng tính năng tự động drop/sync bảng (như `synchronize: true` của TypeORM).

2. **Bảo mật kết nối:**
   - Sử dụng biến môi trường từ `src/config/env.config.ts`.
   - Không in connection string chứa password ra console log.
   - Trong môi trường local hoặc CI, khi chưa có database credentials, ứng dụng và health check phải khởi động được và trả về trạng thái gracefully thay vì crash tiến trình.

---

## 3. Tuân thủ API Contract & Testing

1. **OpenAPI Spec Compliance:**
   - Controller route, HTTP method, status codes, query params và response payload phải khớp hoàn toàn với `packages/api-contract/openapi.yaml`.
   - Không tự ý thay đổi contract trước khi được Tech Lead và Frontend Lead phê duyệt.

2. **Viết kiểm thử tự động (Unit & Integration Tests):**
   - Mọi Service và Controller quan trọng phải có file test tương ứng (`.spec.ts`).
   - Kiểm thử các trường hợp biên: OTP hết hạn, tài khoản chưa được duyệt cố tình đăng bài, số dư điểm uy tín, lỗi kết nối CSDL.
   - Chạy lệnh `pnpm test` và `pnpm typecheck` trước khi bàn giao.
