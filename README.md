# Campus Marketplace

Nền tảng thương mại điện tử sinh viên nội bộ trường đại học, phục vụ việc mua bán, trao đổi đồ dùng cũ và đăng tin tìm mua đồ dùng học tập/sinh hoạt phòng trọ sinh viên.

---

## 1. Kiến trúc & Công nghệ

Dự án áp dụng mô hình **Monorepo (pnpm workspace)** kết hợp kiến trúc **Modular Monolith** cho backend nhằm đảm bảo tính đơn giản trong vận hành, kiểm soát chặt chẽ hợp đồng API và tối ưu hiệu suất phát triển.

### Công nghệ sử dụng

- **Monorepo:** pnpm workspace (Node.js `20.20.1`, pnpm `10.14.0`)
- **Frontend (`@campus/frontend`):** React 18, Vite, TypeScript, Vitest, Testing Library.
- **Backend (`@campus/backend`):** NestJS, TypeScript, Node-postgres (`pg`) SQL-first, Jest, Supertest.
- **Database:** PostgreSQL v1.2 (18 bảng) trên Supabase.
- **API Contract (`@campus/api-contract`):** OpenAPI 3.x (49 endpoints), thiết kế và mock server trên Apidog.
- **CI/CD:** GitHub Actions.
- **Code Quality:** ESLint, Prettier, TypeScript Strict Mode.

---

## 2. Cấu trúc Thư mục

```text
campus-marketplace/
├── AGENTS.md                  # Quy chế phối hợp AI Agents và Git Workflow
├── CLAUDE.md                  # Tham chiếu quy chuẩn cho Claude Code
├── README.md                  # Tài liệu hướng dẫn dự án
├── package.json               # Root workspace configuration
├── pnpm-workspace.yaml        # Khai báo các packages và apps
├── pnpm-lock.yaml             # Khóa phiên bản dependencies
├── .gitignore                 # Cấu hình bỏ qua tệp nhạy cảm
├── .editorconfig              # Quy chuẩn định dạng văn bản
├── .env.example               # Mẫu biến môi trường
│
├── apps/
│   ├── frontend/              # Ứng dụng Web Client (@campus/frontend)
│   │   ├── AGENTS.md          # Hướng dẫn chuyên biệt cho Frontend Agent
│   │   ├── src/
│   │   │   ├── app/           # App root, styles, router
│   │   │   ├── pages/         # Màn hình trang
│   │   │   ├── features/      # Các tính năng theo domain
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── services/      # Typed API client
│   │   │   └── hooks/         # Custom React hooks
│   │   └── package.json
│   │
│   └── backend/               # Ứng dụng API Gateway & Modular Monolith (@campus/backend)
│       ├── AGENTS.md          # Hướng dẫn chuyên biệt cho Backend Agent
│       ├── src/
│       │   ├── modules/       # Domain modules (health, auth, posts, v.v.)
│       │   ├── common/        # Filters, Interceptors, Guards, Pipes
│       │   ├── config/        # Environment & Database config
│       │   └── database/      # PostgreSQL pool service & Base repository (SQL-first)
│       ├── test/              # E2E & Integration tests
│       └── package.json
│
├── packages/
│   └── api-contract/          # Gói hợp đồng OpenAPI 3.x (@campus/api-contract)
│       ├── openapi.yaml       # OpenAPI spec v1.2 (49 endpoints)
│       ├── index.ts           # Type definitions & contract metadata
│       └── package.json
│
├── database/                  # Quản lý CSDL PostgreSQL Supabase
│   ├── AGENTS.md              # Quy tắc bảo vệ CSDL
│   ├── baseline/              # Baseline DDL v1.2 (18 bảng)
│   ├── migrations/            # SQL migrations phiên bản
│   ├── seeds/                 # Dữ liệu khởi tạo (danh mục, tham số)
│   └── schema/                # Tài liệu chi tiết các bảng
│
├── docs/                      # Tài liệu dự án
│   ├── ARCHITECTURE.md        # Kiến trúc hệ thống toàn diện (9 phần chuẩn hóa)
│   ├── architecture/          # Kiến trúc Modular Monolith
│   ├── business-rules/        # Hồ sơ quy tắc nghiệp vụ v1.2
│   ├── api/                   # Hợp đồng API OpenAPI v1.2
│   └── decisions/             # Architecture Decision Records (ADRs)
│
├── tasks/                     # Quản lý tiến độ và bàn giao
│   ├── BACKLOG.md             # Danh sách nhiệm vụ theo giai đoạn
│   ├── AGENT_HANDOFF.md       # Nhật ký bàn giao trạng thái công việc
│   └── TASK_TEMPLATE.md       # Mẫu khởi tạo nhiệm vụ mới
│
└── .github/                   # Cấu hình GitHub
    ├── workflows/ci.yml       # GitHub Actions CI workflow
    ├── ISSUE_TEMPLATE/        # Mẫu Issue (bug, feature, task)
    └── pull_request_template.md # Mẫu Pull Request chuẩn
```

---

## 3. Bắt đầu phát triển (Quickstart)

### Điều kiện tiên quyết

- **Node.js:** `v20.20.1` (hoặc bản `20.x` LTS tương thích)
- **pnpm:** `10.14.0`
- **PostgreSQL:** Đã cấu hình trên Supabase (hoặc chạy local PostgreSQL)

### Cài đặt dependencies

```bash
pnpm install
```

### Cấu hình biến môi trường

Sao chép `.env.example` sang `.env` ở thư mục gốc và trong các app nếu cần:

```bash
cp .env.example .env
```

### Chạy môi trường phát triển (Development)

Chạy đồng thời cả Frontend và Backend:

```bash
pnpm dev
```

- **Frontend Web:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000/api/v1](http://localhost:3000/api/v1)
- **Health Check Endpoint:** [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

### Kiểm thử và kiểm tra mã nguồn

```bash
# Kiểm tra linting
pnpm lint

# Kiểm tra kiểu TypeScript
pnpm typecheck

# Chạy toàn bộ automated tests
pnpm test

# Build production bundle cho toàn bộ monorepo
pnpm build
```

---

## 4. Quản lý tác vụ & Quy trình bàn giao

- **Bàn giao công việc:** Xem [tasks/AGENT_HANDOFF.md](tasks/AGENT_HANDOFF.md). Mọi phiên làm việc phải ghi nhận trạng thái tại đây.
- **Tiến độ dự án:** Xem [tasks/BACKLOG.md](tasks/BACKLOG.md).
- **Quy tắc đóng góp:** Xem [AGENTS.md](AGENTS.md).
