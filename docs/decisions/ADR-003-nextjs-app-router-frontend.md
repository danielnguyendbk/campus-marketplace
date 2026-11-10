# ADR 003: Lựa chọn Next.js 14+ (App Router) cho Web Client

## Trạng thái
Đã chấp thuận (Accepted) — Quyết định D11

## Bối cảnh
Trước đây dự án từng cân nhắc cấu trúc React 18 SPA với Vite cho ứng dụng web client (`apps/frontend`). Tuy nhiên, trong quá trình thẩm định kỹ thuật và đối chiếu với yêu cầu nghiệp vụ của nền tảng thương mại điện tử sinh viên:
1. Tin đăng sản phẩm cũ và tin tìm mua cần được chia sẻ qua liên kết trên các mạng xã hội, nhóm Zalo/Facebook sinh viên; do đó bắt buộc phải hỗ trợ Server-Side Rendering (SSR) hoặc Static Site Generation (SSG/ISR) để tạo OpenGraph metadata và tối ưu SEO.
2. Giao diện người dùng yêu cầu phân tầng rõ rệt: Khách chưa đăng nhập (Unauthenticated/Guest) bị chặn bảng tin (HTTP 401); tài khoản chờ duyệt thẻ (`PENDING`) chỉ xem bảng tin rút gọn (`PendingFeedPage`); tài khoản đã duyệt (`APPROVED`) xem tin đầy đủ và tương tác realtime.
3. Web Client đồng thời cần tích hợp các tương tác trực tiếp: Realtime chat qua Socket.IO Gateway (`/ws`), upload ảnh thẻ sinh viên và ảnh sản phẩm lên Object Storage.

## Quyết định
1. Sử dụng **Next.js 14+ (App Router)** kết hợp React 18 và TypeScript cho toàn bộ `apps/frontend`:
   - Tận dụng Server Components để render tĩnh/máy chủ trang danh sách bài đăng và trang chi tiết (`/posts/[id]`), tối ưu hóa tốc độ tải trang ban đầu (Core Web Vitals) và hiển thị preview thẻ mạng xã hội chuẩn.
   - Sử dụng Client Components (`"use client"`) cho các module cần state tương tác: form đăng ký OTP, upload tài liệu xác minh thẻ sinh viên, cửa sổ chat realtime WebSocket và modal báo cáo vi phạm.
2. Thống nhất một nguồn tài liệu kiến trúc duy nhất: Loại bỏ hoàn toàn mâu thuẫn React/Vite trong toàn bộ tài liệu kiến trúc (`docs/ARCHITECTURE.md`, `AGENTS.md`) và mã nguồn.
3. Kiểm thử tự động với **Vitest** và React Testing Library được tích hợp liền mạch với cấu hình Next.js.

## Hệ quả
- Khắc phục triệt để mâu thuẫn công nghệ giữa thiết kế và mã nguồn thực tế.
- Khả năng SEO bài đăng và chia sẻ liên kết mạng xã hội hoạt động tối ưu.
- Quản lý route và layout tập trung thông qua App Router (`src/app/layout.tsx`, `src/app/page.tsx`).

