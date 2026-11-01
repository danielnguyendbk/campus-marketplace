# ADR 002: Lựa chọn SQL-First với Thư viện pg và Repository Layer

## Trạng thái
Đã chấp thuận (Accepted)

## Bối cảnh
Database đã được thiết kế chi tiết trên dbdiagram.io v1.2 với 18 bảng, nhiều kiểu dữ liệu ENUM tùy chỉnh, chỉ mục và rằng buộc khóa ngoại, được deploy lên PostgreSQL trên Supabase. Nhóm cần một phương pháp truy xuất dữ liệu vừa đảm bảo hiệu năng cao, vừa kiểm soát chính xác SQL query và không phát sinh mapping phức tạp ngoài ý muốn của ORM.

## Quyết định
1. Sử dụng thư viện chuẩn `pg` (Node-postgres) kết hợp Connection Pooling.
2. Xây dựng **Repository Layer** theo định hướng **SQL-first**:
   - Viết các câu truy vấn SQL thuần (Prepared Statements) rõ ràng, tận dụng triệt để index và tối ưu EXPLAIN PLAN.
   - Tránh việc tự động sinh query cồng kềnh, N+1 query tiềm ẩn thường gặp ở các ORM nặng.
   - Đảm bảo tính minh bạch, dễ audit và tương thích 100% với DDL trong `database/baseline/schema_v1.2.sql`.

## Hệ quả
- Developer và Backend AI Agent phải nắm vững câu lệnh SQL PostgreSQL.
- Dễ dàng debug và tối ưu hóa truy vấn hiệu năng cao khi hệ thống tăng tải.
- Không lo rủi ro schema drift giữa code ORM entity và schema thực tế trên Supabase.
