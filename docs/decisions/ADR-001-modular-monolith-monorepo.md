# ADR 001: Lựa chọn Monorepo (pnpm) và Kiến trúc Modular Monolith

## Trạng thái
Đã chấp thuận (Accepted)

## Bối cảnh
Dự án Campus Marketplace là nền tảng thương mại sinh viên dành cho đồ dùng cũ với 18 bảng CSDL, khoảng 49 API endpoints và đội ngũ phát triển tinh gọn chia làm Frontend và Backend. Cần một cấu trúc dự án tối ưu cho việc phối hợp, quản lý version và chia sẻ hợp đồng API giữa các thành viên.

## Quyết định
1. Sử dụng **pnpm workspace** làm Monorepo manager:
   - Tối ưu dung lượng đĩa và tốc độ cài đặt dependencies qua hard-link store.
   - Thống nhất quy trình CI/CD, lint, test và typecheck qua root scripts.
   - Chia sẻ gói hợp đồng API `@campus/api-contract` trực tiếp giữa các ứng dụng mà không cần publish lên private registry.
2. Áp dụng kiến trúc **Modular Monolith** cho Backend:
   - Toàn bộ backend chạy trong một tiến trình NestJS duy nhất, dễ triển khai và theo dõi.
   - Phân chia domain thành các modules độc lập, giao tiếp nội bộ qua service calls rõ ràng.
   - Từ chối Microservices, Kafka, Kubernetes trong giai đoạn này để tránh overhead hạ tầng không cần thiết.

## Hệ quả
- Đội ngũ phát triển chỉ cần clone 1 repo duy nhất để chạy full-stack.
- Quản lý API contract và type definitions nhất quán.
- Dễ dàng tách riêng thành microservice trong tương lai nếu có module nào cần scale độc lập.
