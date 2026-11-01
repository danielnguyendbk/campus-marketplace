# CLAUDE.md - Campus Marketplace Instructions

Tệp này tham chiếu trực tiếp đến hệ thống quy tắc phát triển của Campus Marketplace. Tránh duy trì hai bộ tài liệu khác nhau.

## Tài liệu quy tắc bắt buộc

- **Quy tắc toàn diện & phối hợp nhóm:** Xem [AGENTS.md](./AGENTS.md)
- **Frontend Guidelines:** Xem [apps/frontend/AGENTS.md](./apps/frontend/AGENTS.md)
- **Backend Guidelines:** Xem [apps/backend/AGENTS.md](./apps/backend/AGENTS.md)
- **Database & Supabase Guidelines:** Xem [database/AGENTS.md](./database/AGENTS.md)
- **Nhật ký nhận & bàn giao nhiệm vụ:** Xem [tasks/AGENT_HANDOFF.md](./tasks/AGENT_HANDOFF.md)
- **Backlog & Kế hoạch:** Xem [tasks/BACKLOG.md](./tasks/BACKLOG.md)

## Lệnh thường dùng trong Monorepo

```bash
# Cài đặt dependencies
pnpm install

# Chạy cả Frontend và Backend ở chế độ dev
pnpm dev

# Kiểm tra cú pháp và quy chuẩn code
pnpm lint

# Kiểm tra lỗi kiểu dữ liệu TypeScript
pnpm typecheck

# Chạy toàn bộ Unit & Integration tests
pnpm test

# Build ứng dụng cho môi trường production
pnpm build
```
