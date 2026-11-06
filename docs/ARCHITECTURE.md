# Campus Marketplace — Kiến trúc Hệ thống & Thiết kế Kỹ thuật (System Architecture & Technical Design)

> **Tài liệu Tham chiếu Kiến trúc Cốt lõi (Core Architecture Documentation)**  
> **Phiên bản:** v1.2 (Đồng bộ Hồ sơ Nghiệp vụ v1.2 & OpenAPI Contract 3.x v1.2)  
> **Dự án:** Campus Marketplace — Nền tảng Thương mại Điện tử Sinh viên Nội bộ  
> **Mã nguồn:** Monorepo (`@campus/frontend`, `@campus/backend`, `@campus/api-contract`)

---

## 1. Overview (Tổng quan Kiến trúc & Công nghệ)

### 1.1. Bối cảnh & Mục tiêu Hệ thống

**Campus Marketplace** là nền tảng thương mại điện tử sinh viên nội bộ trường đại học, phục vụ nhu cầu trao đổi, mua bán đồ dùng cũ (giáo trình, thiết bị học tập, vật dụng phòng trọ) và đăng tin tìm mua (buy requests).

Hệ thống được thiết kế hướng tới 4 mục tiêu kiến trúc trọng yếu:

1. **Tin cậy & Xác thực chặt chẽ:** Chỉ sinh viên sở hữu email trường đại học (`@*.edu.vn`) và đã được Admin phê duyệt minh chứng thẻ sinh viên mới được tham gia giao dịch đầy đủ.
2. **Bảo vệ Quyền riêng tư (Privacy-by-Design):** Che giấu số điện thoại người bán, chỉ cho phép tiết lộ có kiểm soát qua sự kiện ghi nhận; ẩn hoàn toàn ảnh thẻ sinh viên sau khi nộp.
3. **Minh bạch & An toàn Giao dịch:** Tích hợp cơ chế chấm điểm uy tín (`reputation_score`), xử lý tranh chấp khiếu nại (`reports`) và tự động áp dụng chế tài vi phạm.
4. **Vận hành Tinh gọn (Operational Simplicity):** Tối ưu hóa chi phí hạ tầng và độ phức tạp vận hành thông qua kiến trúc **Modular Monolith** và quản lý mã nguồn tập trung bằng **Monorepo**.

### 1.2. Bảng Công nghệ Lựa chọn (Technology Stack)

| Phân vùng              | Công nghệ lựa chọn                 | Phiên bản                         | Vai trò & Lý do lựa chọn                                                                                                |
| :--------------------- | :--------------------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Monorepo Manager**   | `pnpm workspace`                   | 10.14.0 (Node.js 20.20.1)         | Quản lý đa dự án, tối ưu bộ nhớ ổ đĩa qua hard-link store, chia sẻ trực tiếp `@campus/api-contract`.                    |
| **Frontend**           | Next.js (App Router)               | Next.js 14+, React 18, TypeScript | Web Client hiện đại kết hợp SSR/SSG (tối ưu SEO tin đăng đồ cũ) và Client Components (Realtime Chat Socket.IO).         |
| **Backend**            | NestJS                             | 10.4.x, TypeScript Strict         | Framework hướng module doanh nghiệp, hỗ trợ Dependency Injection, Pipes, Interceptors, Guards đồng bộ.                  |
| **Database Access**    | SQL-first với `node-postgres (pg)` | 8.13.x                            | Triết lý **SQL-first** (thay thế Prisma ORM), kiểm soát tối đa câu truy vấn, chỉ mục, Explain Plan và hiệu năng pooler. |
| **Database Engine**    | PostgreSQL trên Supabase           | PostgreSQL 15/17                  | CSDL quan hệ chuẩn ACID, hỗ trợ 18 bảng nghiệp vụ v1.2, kết nối bắt buộc xác thực TLS Root CA.                          |
| **Object Storage**     | Cloudflare R2                      | S3-Compatible API                 | Lưu trữ ảnh bài đăng, ảnh thẻ sinh viên mật và tệp đính kèm tin nhắn; hỗ trợ Short-lived Signed URLs.                   |
| **Realtime Engine**    | Socket.IO / WebSocket              | 4.x (`/ws`)                       | Cập nhật tin nhắn tức thì, thông báo hệ thống và tiến trình khiếu nại báo cáo cho người dùng `APPROVED`.                |
| **API Contract**       | OpenAPI 3.x / Apidog               | OpenAPI 3.0.3 v1.2                | Contract-first: Định nghĩa 49 endpoints, Envelope chuẩn hóa và Schema Validation cho FE/BE.                             |
| **Kiểm thử (Testing)** | Vitest, RTL, Jest, Supertest       | Mới nhất                          | Unit test, Component test, Backend E2E và Contract Schema regression testing.                                           |
| **CI/CD & Chất lượng** | GitHub Actions, ESLint, Prettier   | TypeScript Strict Mode            | Tự động hóa kiểm tra Lint, Typecheck, Test và Build trên từng Pull Request.                                             |

---

### 1.3. Xác Nhận Lựa Chọn Công Nghệ Cốt Lõi (Core Technology Stack Confirmation)

Theo định hướng và yêu cầu đề tài của nhóm, các công nghệ cốt lõi được chốt chính thức như sau:

| Thành phần cốt lõi  | Công nghệ chốt chính thức              | Lý do & Định hướng kiến trúc                                                                                                                                                                                                                                                                                                  |
| :------------------ | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**        | **Next.js 14+ (App Router)**           | **Chốt sử dụng Next.js**: Hỗ trợ Server-Side Rendering (SSR) & Static Generation (SSG/ISR) giúp tối ưu SEO cho các bài đăng sản phẩm sinh viên (`/posts/[id]`), tự động tạo OpenGraph Preview khi chia sẻ bài đăng qua mạng xã hội, kết hợp Client Components cho Realtime Chat Socket.IO (`/ws`) và bảo vệ dữ liệu nhạy cảm. |
| **Database**        | **PostgreSQL trên Supabase**           | **Chốt sử dụng PostgreSQL**: Hệ quản trị cơ sở dữ liệu quan hệ chuẩn ACID, lưu trữ toàn vẹn 18 bảng nghiệp vụ v1.2, vận hành trên Supabase Cloud với Transaction Pooler (PgBouncer) và thực thi bắt buộc xác thực TLS CA certificate.                                                                                         |
| **Backend**         | **NestJS**                             | Giữ nguyên kiến trúc Modular Monolith NestJS 10, quản lý Dependency Injection, Interceptors, Pipes, Filters và Guards tập trung.                                                                                                                                                                                              |
| **Database Access** | **SQL-first với `node-postgres (pg)`** | Sử dụng SQL-first thay vì Prisma ORM để kiểm soát 100% câu truy vấn SQL thô, tối ưu Explain Plan, chỉ mục trên 18 bảng CSDL v1.2, loại bỏ overhead binary engine và tương thích hoàn hảo với Supabase Transaction Pooler.                                                                                                     |

> [!IMPORTANT]
> **Xác nhận Kiến trúc Cốt lõi (Next.js & PostgreSQL):**
>
> 1. **Next.js là Web Client chính thức:** Đối với sàn thương mại điện tử sinh viên nội bộ, khả năng tìm kiếm và hiển thị xem trước bài đăng (SEO / Social Preview) là cực kỳ quan trọng. Do đó nhóm chốt sử dụng **Next.js 14+ App Router**.
> 2. **PostgreSQL là CSDL quan hệ chuẩn:** Toàn bộ 18 bảng nghiệp vụ v1.2 (người dùng, bài đăng, hội thoại, báo cáo khiếu nại, điểm uy tín) được thiết kế và vận hành trên PostgreSQL 15/17.

---

## 2. System Architecture (Sơ đồ Kiến trúc Toàn hệ thống)

Hệ thống kết nối chặt chẽ giữa Web Client, Backend API Gateway, Cơ sở dữ liệu quan hệ PostgreSQL và Cloudflare R2 Object Storage:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client Layer"]
        WebClient["Web Client (Next.js 14+ App Router)"]
    end

    subgraph GatewayLayer ["2. Application & Gateway Layer (NestJS Modular Monolith)"]
        APIGateway["API Gateway & Middleware Engine\n(Global Prefix: /api/v1)"]
        TransformInterceptor["TransformInterceptor\n(Success Envelope & Root-level Meta)"]
        ExceptionFilter["AllExceptionsFilter\n(Conceal 500, Strict ErrorEnvelope)"]
        WSServer["WebSocket Gateway (/ws)\n(Socket.IO Realtime Engine)"]
    end

    subgraph StorageAndRealtime ["3. Realtime & External Storage Layer"]
        R2Public["Cloudflare R2 (Public CDN Bucket)\n- Post Images (SELL)"]
        R2Private["Cloudflare R2 (Private Bucket)\n- Student ID Cards (Encrypted)\n- Chat Attachments (90-day TTL)"]
        SMTP["Mail Service (SMTP)\n- University OTP Dispatcher"]
    end

    subgraph DataLayer ["4. Data Persistence Layer (Supabase PostgreSQL v1.2)"]
        SupabasePooler["Supabase Transaction Pooler (Port 6543 / 5432)\nEnforced TLS CA Verification (rejectUnauthorized: true)"]
        CoreDB[("PostgreSQL Database (18 Tables)\n- Users & Evidence\n- Posts & Details\n- Conversations & Messages\n- Reports & Reputation")]
    end

    %% Client Interactions
    WebClient -->|"HTTPS REST API (/api/v1)\nEnvelope: { success, data, [meta], timestamp }"| APIGateway
    WebClient <-->|"WSS Connection (/ws)\nAuthenticated via Handshake Bearer Token"| WSServer
    WebClient -->|"Direct Upload / Fetch via Short-lived Signed URL"| R2Private
    WebClient -->|"Fetch Public Media via CDN"| R2Public

    %% Gateway to Filters and Modules
    APIGateway --> TransformInterceptor
    APIGateway --> ExceptionFilter
    APIGateway -->|"Dispatch OTP"| SMTP

    %% Backend to Storage & DB
    APIGateway -->|"Generate Presigned Put/Get URL"| R2Private
    WSServer -->|"Broadcast Events (message.created, etc.)"| WebClient
    APIGateway -->|"SQL-first pg Pool (Strict TLS Verification)"| SupabasePooler
    SupabasePooler --> CoreDB
```

### Luồng Xử lý Dữ liệu Chính (Data Flow):

1. **Xác thực & Ủy quyền:** Request gửi tới mang theo JWT Bearer Token trong header `Authorization`. `JwtAuthGuard` giải mã token, `VerificationGuard` và `RolesGuard` thẩm định quyền truy cập dựa trên trạng thái (`APPROVED`, `PENDING`, `ADMIN`).
2. **Bọc gói Phản hồi Thành công (Success Envelope):** `TransformInterceptor` bọc dữ liệu trả về từ Controller:
   - Dữ liệu đơn lẻ: `{ success: true, data: T, timestamp: ISO8601 }`.
   - Dữ liệu phân trang: `{ success: true, data: T[], meta: PageMeta, timestamp: ISO8601 }` (Root-level `data` và `meta`, tuyệt đối không lồng `data: { data, meta }`).
3. **Chuẩn hóa Phản hồi Lỗi (Error Envelope):** Khi có ngoại lệ, `AllExceptionsFilter` bắt toàn bộ và trả về `{ error: { code, message, details? }, requestId? }` tuân thủ nghiêm ngặt ràng buộc `additionalProperties: false`. Mọi lỗi 500 đều được giấu kín thông tin nhạy cảm và trả về thông điệp an toàn `"Internal server error"`.

---

## 3. Monorepo Structure (Cấu trúc Thư mục Dự án)

Dự án áp dụng mô hình **pnpm monorepo workspace** nhằm thống nhất quản lý phụ thuộc, chuẩn hóa tooling và chia sẻ mã nguồn hợp đồng API giữa các bên:

```text
campus-marketplace/
├── apps/
│   ├── frontend/                      # @campus/frontend — Ứng dụng Web Client Next.js 14+ (App Router)
│   │   ├── src/
│   │   │   ├── app/                   # App bootstrap, Providers, Global Layout
│   │   │   ├── components/            # Reusable UI components (Buttons, Modals, Inputs)
│   │   │   ├── features/              # Feature modules (auth, posts, chat, verification)
│   │   │   ├── hooks/                 # Custom React hooks (useApiHealth, useAuth)
│   │   │   ├── pages/                 # Màn hình trang (HomePage, PostDetailPage, etc.)
│   │   │   ├── services/              # ApiClient (Strict Envelope unwrapping, requestPaginated)
│   │   │   └── test/                  # Vitest suites & Component tests
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── backend/                       # @campus/backend — NestJS Modular Monolith API Gateway
│       ├── src/
│       │   ├── common/                # Shared Cross-cutting Concerns
│       │   │   ├── filters/           # AllExceptionsFilter (ErrorEnvelope, 500 redaction)
│       │   │   ├── interceptors/      # TransformInterceptor (Success & Paginated Envelope)
│       │   │   ├── interfaces/        # ApiResponse, PaginatedResponse, PageMeta, ErrorEnvelope
│       │   │   └── guards/            # JwtAuthGuard, RolesGuard, VerificationGuard
│       │   ├── config/                # Database configuration & TLS CA cert loaders
│       │   ├── database/              # Node-postgres (pg) connection pool & base repository
│       │   └── modules/               # Domain Business Modules (health, auth, posts, chat, etc.)
│       ├── test/                      # E2E test suites (contract-schemas, error-envelope, app)
│       └── package.json
│
├── packages/
│   └── api-contract/                  # @campus/api-contract — Single Source of Truth
│       ├── openapi.yaml               # OpenAPI Contract 3.x v1.2 (49 operations chuẩn hóa)
│       ├── index.ts                   # Export type definitions từ schema
│       └── package.json
│
├── database/                          # Quản lý Cơ sở dữ liệu PostgreSQL (Supabase)
│   ├── baseline/                      # Baseline DDL v1.2 (18 bảng chuẩn)
│   ├── migrations/                    # SQL migration files có phiên bản
│   ├── seeds/                         # Dữ liệu khởi tạo (categories, system_configs)
│   ├── schema/                        # Tài liệu chi tiết từng bảng
│   └── supabase-ca.crt                # Supabase Root CA 2021 chứng thực TLS
│
├── docs/                              # Tài liệu Kỹ thuật & Nghiệp vụ Dự án
│   ├── architecture/                  # Thiết kế kiến trúc (authorization_matrix, state_machines)
│   ├── business-rules/                # 20 Quy tắc nghiệp vụ cốt lõi (BR-01 đến BR-20)
│   ├── api/                           # Hướng dẫn tích hợp API Client, status matrix
│   └── decisions/                     # Architecture Decision Records (ADRs)
│
├── tasks/                             # Quản lý Tiến độ & Bàn giao AI Agent
│   ├── AGENT_HANDOFF.md               # Nhật ký bàn giao trạng thái công việc
│   ├── BACKLOG.md                     # Danh sách nhiệm vụ backlog theo giai đoạn
│   └── TASK_TEMPLATE.md               # Biểu mẫu khởi tạo task mới
│
├── .github/                           # GitHub Actions CI Workflow & Templates
│   └── workflows/ci.yml               # Pipeline kiểm thử tự động (Lint, Typecheck, Test, E2E, Build)
├── AGENTS.md                          # Quy chuẩn phối hợp AI Agents và Gitflow
├── package.json                       # Root workspace scripts & devDependencies
└── pnpm-workspace.yaml                # Khai báo cấu trúc workspace packages
```

### Phân vùng Trách nhiệm (Code Ownership):

- **Frontend Agent/Team:** Toàn quyền trong `apps/frontend/`. Chỉ đọc `packages/api-contract/`. Tuyệt đối không can thiệp vào mã nguồn backend hoặc database.
- **Backend Agent/Team:** Toàn quyền trong `apps/backend/` và quản lý migration trong `database/migrations/`.
- **Database Lead:** Quản lý cấu trúc `database/`. Tuyệt đối không sửa schema trực tiếp trên remote DB mà không qua migration và PR.
- **Tech Lead / Architect:** Duyệt các thay đổi trong `packages/api-contract/`, `.github/` và cấu trúc root.

---

## 4. Backend Architecture (Kiến trúc Modular Monolith & Phân bổ Modules)

Backend được tổ chức theo kiến trúc **Modular Monolith** kết hợp **Layered Architecture (3 tầng)** bên trong từng module:

```mermaid
graph TD
    subgraph Client ["Client Layer"]
        HTTPClient["HTTP Request (REST /api/v1)"]
    end

    subgraph ModuleBoundary ["Domain Module Container (e.g. PostModule)"]
        ControllerLayer["1. Controller Layer\n- DTO Validation Pipe\n- Auth & Verification Guards\n- Route Handling"]
        ServiceLayer["2. Service Layer\n- Business Logic & Invariants\n- Transaction Management\n- Domain Event Emission"]
        RepoLayer["3. Repository Layer (SQL-first)\n- Parameterized SQL Queries\n- Node-postgres (pg) Client\n- Entity Mapping"]
    end

    subgraph DataStore ["Database Layer"]
        PGDB[("Supabase PostgreSQL")]
    end

    HTTPClient --> ControllerLayer
    ControllerLayer --> ServiceLayer
    ServiceLayer --> RepoLayer
    RepoLayer --> PGDB
```

### Danh mục các Domain Modules và Trách nhiệm:

```
+-----------------------------------------------------------------------------------+
|                            NESTJS MODULAR MONOLITH                                |
+-----------------------------------------------------------------------------------+
|  +----------------------+  +----------------------+  +-------------------------+  |
|  |     HealthModule     |  |      AuthModule      |  |       UserModule        |  |
|  | - Health Check Probe |  | - Email OTP Flow     |  | - Profile Mgmt (/me)    |  |
|  | - DB Pool Latency    |  | - Student Evidence   |  | - User Preferences     |  |
|  | - System Environment |  | - JWT Tokens Issuance|  | - Reputation Overview   |  |
|  +----------------------+  +----------------------+  +-------------------------+  |
|  +----------------------+  +----------------------+  +-------------------------+  |
|  |      PostModule      |  |      ChatModule      |  |       TrustModule       |  |
|  | - SELL & BUY Posts   |  | - Conversations      |  | - Reputation Engine     |  |
|  | - Feed (PENDING/APP) |  | - Text Messages      |  | - Report State Machine  |  |
|  | - Phone Reveal Event |  | - Attachments & URL  |  | - Seller Response Flow  |  |
|  +----------------------+  +----------------------+  +-------------------------+  |
|  +------------------------------------------------+  +-------------------------+  |
|  |                  AdminModule                   |  |      Common Kernel      |  |
|  | - Student Verification Review (Presigned URL)  |  | - TransformInterceptor  |  |
|  | - Report Arbitration & Dispute Resolution      |  | - AllExceptionsFilter   |  |
|  | - User Status Management (SUSPENDED)           |  | - Database Pool Config  |  |
|  | - Audit Logs & System Configurations           |  | - Auth & Role Guards    |  |
|  +------------------------------------------------+  +-------------------------+  |
+-----------------------------------------------------------------------------------+
```

1. **HealthModule (`src/modules/health`):** Cung cấp endpoint kiểm tra tình trạng hệ sinh thái (`GET /health`), độ trễ truy vấn CSDL và phiên bản runtime.
2. **AuthModule (`src/modules/auth`):** Xử lý đăng ký bằng email trường (`POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/register`), đăng nhập JWT (`POST /auth/login`), nộp minh chứng thẻ sinh viên (`POST /me/evidence`).
3. **UserModule (`src/modules/user`):** Quản lý hồ sơ người dùng (`GET /me`, `PATCH /me`), thiết lập sở thích cá nhân hóa (`GET /me/preferences`).
4. **PostModule (`src/modules/posts`):** Quản lý bài đăng bán (`SELL`) kèm ảnh bắt buộc và bài đăng tìm mua (`BUY_REQUEST`); phân phối bảng tin (`GET /feed`) tách biệt cho tài khoản `PENDING` và `APPROVED`; quản lý sự kiện tiết lộ số điện thoại (`POST /posts/{id}/reveal-phone`).
5. **ChatModule (`src/modules/chat`):** Quản lý phòng chat riêng tư giữa người mua và người bán (`conversations`), gửi tin nhắn (`messages`), tải tệp đính kèm với Signed URL an toàn (`attachments`).
6. **TrustModule (`src/modules/trust`):** Quản lý vòng đời báo cáo vi phạm (`reports`) theo State Machine 6 trạng thái; tự động tính toán trừ điểm uy tín (`reputation_events`) khi người bán vi phạm chu kỳ phản hồi ($K=3$).
7. **AdminModule (`src/modules/admin`):** Xét duyệt minh chứng thẻ sinh viên bằng Signed URL bảo mật, phân xử báo cáo vi phạm, quản lý khóa tài khoản (`SUSPENDED`), truy vấn lịch sử kiểm toán (`audit_logs`) và tham số hệ thống (`system_configs`).

---

## 5. Database Design (ERD & Thiết kế Cơ sở Dữ liệu v1.2)

Cơ sở dữ liệu bao gồm **18 bảng chuẩn hóa v1.2** triển khai trên PostgreSQL, bảo đảm tính toàn vẹn tham chiếu, ràng buộc kiểm tra và tối ưu chỉ mục:

```mermaid
erDiagram
    users ||--o{ otp_verifications : "has"
    users ||--o{ student_evidences : "submits"
    users ||--o| user_preferences : "configures"
    users ||--o{ posts : "creates"
    users ||--o{ conversations : "participates_as_member"
    users ||--o{ messages : "sends"
    users ||--o{ reports : "files_or_reported"
    users ||--o{ reputation_events : "earns_or_loses"
    users ||--o{ phone_reveal_events : "reveals_to"
    users ||--o{ notifications : "receives"
    users ||--o{ audit_logs : "targeted_or_performed"

    categories ||--o{ posts : "categorizes"

    posts ||--o| sell_details : "has_if_SELL"
    posts ||--o| buy_request_details : "has_if_BUY_REQUEST"
    posts ||--o{ post_images : "contains"
    posts ||--o{ conversations : "originates_from"
    posts ||--o{ reports : "targeted_in"
    posts ||--o{ phone_reveal_events : "associated_with"

    conversations ||--o{ messages : "contains"
    messages ||--o{ attachments : "attaches"

    reports ||--o{ reputation_events : "triggers_deduction"
```

### Tóm tắt 18 Bảng theo Phân nhóm Nghiệp vụ:

| Nhóm nghiệp vụ                  | Tên bảng              | Khóa chính        | Ràng buộc trọng yếu / Mô tả                                                                                                                                            |
| :------------------------------ | :-------------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Xác thực & Người dùng**       | `users`               | `id (UUID)`       | `school_email` UNIQUE (`@*.edu.vn`), `role` (USER, ADMIN), `verification_status` (PENDING, APPROVED, REJECTED), `reputation_score` ($0.0 \le x \le 5.0$, default 5.0). |
|                                 | `otp_verifications`   | `id (UUID)`       | Lưu mã băm `code_hash`, thời hạn `expires_at`, chống spam OTP.                                                                                                         |
|                                 | `student_evidences`   | `id (UUID)`       | Lưu `card_image_ref` (Private R2 key), ẩn hoàn toàn trên giao diện sinh viên (BR-03).                                                                                  |
| **Danh mục & Sở thích**         | `categories`          | `id (VARCHAR)`    | Danh mục hàng hóa (TEXTBOOK, ELECTRONICS, etc.), hỗ trợ slug và thứ tự hiển thị.                                                                                       |
|                                 | `user_preferences`    | `user_id (UUID)`  | Lưu mảng category yêu thích và từ khóa quan tâm phục vụ thuật toán gợi ý feed.                                                                                         |
| **Bài đăng & Chi tiết**         | `posts`               | `id (UUID)`       | `post_type` (SELL, BUY_REQUEST), `status` (ACTIVE, HIDDEN, SOLD, EXPIRED, CLOSED).                                                                                     |
|                                 | `sell_details`        | `post_id (UUID)`  | Giá bán `price > 0`, độ mới `condition`, cờ `allow_phone_reveal`.                                                                                                      |
|                                 | `buy_request_details` | `post_id (UUID)`  | Ngân sách `budget_min <= budget_max`.                                                                                                                                  |
|                                 | `post_images`         | `id (UUID)`       | Ảnh bài đăng (Public CDN storage), bài đăng SELL yêu cầu tối thiểu 1 ảnh.                                                                                              |
| **Giao tiếp & Tin nhắn**        | `conversations`       | `id (UUID)`       | Liên kết `post_id`, danh sách `members` (buyer và seller), trạng thái OPEN / ARCHIVED.                                                                                 |
|                                 | `messages`            | `id (UUID)`       | Loại tin nhắn (TEXT, IMAGE, ATTACHMENT), kiểm tra thành viên hội thoại.                                                                                                |
|                                 | `attachments`         | `id (UUID)`       | Lưu `storage_key` private, mã băm, kích thước, tự động hết hạn sau 90 ngày.                                                                                            |
| **Uy tín, Báo cáo & Kiểm toán** | `reports`             | `id (UUID)`       | State Machine 6 trạng thái: `SUBMITTED`, `WAITING_SELLER_RESPONSE`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED`, `NO_RESPONSE`.                                            |
|                                 | `reputation_events`   | `id (UUID)`       | Điểm thay đổi (`delta_points`), lý do, liên kết báo cáo vi phạm, chống trừ trùng lặp (`report_cycle_key`).                                                             |
|                                 | `audit_logs`          | `id (UUID)`       | Nhật ký hành động nhạy cảm của Admin (duyệt thẻ, phân xử báo cáo, khóa tài khoản).                                                                                     |
| **Tương tác & Quản trị**        | `phone_reveal_events` | `id (UUID)`       | Ghi nhận lượt mở số điện thoại người bán của tài khoản APPROVED (BR-08).                                                                                               |
|                                 | `notifications`       | `id (UUID)`       | Thông báo in-app (REPORT_CREATED, VERIFICATION_APPROVED, etc.).                                                                                                        |
|                                 | `system_configs`      | `config_key (PK)` | Cấu hình tham số hệ thống động (ngưỡng chu kỳ $K=3$, thời hạn phản hồi báo cáo 48h).                                                                                   |

---

## 6. API Design (Quy ước Thiết kế API & Hợp đồng v1.2)

### 6.1. Quy ước RESTful & Envelope Kiến trúc

Hệ thống tuân thủ chuẩn RESTful API với tiền tố bắt buộc `/api/v1`. Toàn bộ phản hồi được chuẩn hóa qua **Response Envelope** đối xứng:

#### 1. Success Envelope (Thành công - HTTP 2xx)

- **Thực thể đơn (Single Entity):**
  ```json
  {
    "success": true,
    "data": {
      "id": "0d8d830e-11bd-440a-b72e-24c8bd3a519a",
      "displayName": "Sinh viên A",
      "role": "USER",
      "verificationStatus": "APPROVED"
    },
    "timestamp": "2026-11-03T12:00:00.000Z"
  }
  ```
- **Phân trang (Paginated Page - Root-Level Data & Meta):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "a23ef463-1a6b-4b2d-a330-0e47edff0217",
        "title": "Giáo trình Java cơ bản",
        "postType": "SELL",
        "price": 120000
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    },
    "timestamp": "2026-11-03T12:00:00.000Z"
  }
  ```
  > [!IMPORTANT]
  > Ràng buộc `additionalProperties: false` được áp dụng cho toàn bộ response schema trong OpenAPI v1.2. Phản hồi phân trang giữ `data` và `meta` ở cấp root, **tuyệt đối không lồng `data: { data, meta }`**.

#### 2. Error Envelope (Lỗi - HTTP 4xx / 5xx)

Tuân thủ nghiêm ngặt schema `ErrorEnvelope` trong OpenAPI v1.2:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Tài khoản PENDING không có quyền xem chi tiết bài đăng.",
    "details": []
  },
  "requestId": "req-1793783931"
}
```

### 6.2. Cơ chế Xác thực & Phiên làm việc (Authentication Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Student as Sinh viên
    participant FE as Web Client (Frontend)
    participant BE as Backend API Gateway
    participant Mail as University Mail Service
    participant DB as Supabase PostgreSQL

    Student->>FE: Nhập email trường (@ptit.edu.vn)
    FE->>BE: POST /api/v1/auth/request-otp
    BE->>DB: Lưu băm mã OTP (code_hash, expires_at)
    BE->>Mail: Gửi mã OTP 6 số vào hộp thư sinh viên
    BE-->>FE: 200 OK (SimpleMessageResponse)

    Student->>FE: Nhập mã OTP từ email
    FE->>BE: POST /api/v1/auth/verify-otp (email, code)
    BE->>DB: Kiểm tra OTP hợp lệ và còn hạn
    BE-->>FE: 200 OK (VerifyOtpResponse: { otpTicket, expiresIn: 600 })

    Student->>FE: Điền thông tin cá nhân & mật khẩu
    FE->>BE: POST /api/v1/auth/register (email, password, displayName, otpTicket)
    BE->>DB: Tạo user (status = PENDING, hash mật khẩu bcrypt)
    BE-->>FE: 201 Created (AuthSessionResponse: { accessToken, user })

    Note over Student,FE: Sinh viên upload ảnh thẻ sinh viên để duyệt
    FE->>BE: POST /api/v1/me/evidence (multipart / cardImageRef)
    BE->>DB: Ghi nhận minh chứng thẻ sinh viên
    BE-->>FE: 201 Created (VerificationResponse: { status: PENDING })
```

---

## 7. Realtime & Storage (Socket.IO & Cloudflare R2)

### 7.1. Hạ tầng Lưu trữ Đối tượng (Cloudflare R2 Object Storage)

Hệ thống sử dụng Cloudflare R2 thông qua giao thức S3-compatible, phân tách thành 2 vùng lưu trữ riêng biệt để đảm bảo an toàn dữ liệu:

```mermaid
flowchart LR
    Client[Web Client]
    Backend[NestJS Backend API]
    R2Private[(Cloudflare R2\nPrivate Bucket)]
    R2Public[(Cloudflare R2\nPublic Bucket)]
    CloudflareCDN[Cloudflare Global CDN]

    %% Private Storage Flow
    Client -->|"1. Yêu cầu upload minh chứng thẻ / đính kèm"| Backend
    Backend -->|"2. Ký Presigned PUT URL (Hạn 15 phút)"| Client
    Client -->|"3. Tải tệp trực tiếp lên R2"| R2Private
    Backend -->|"4. Cấp Short-lived Signed GET URL cho Admin / Hội thoại"| Client
    Client -->|"5. Tải tệp qua Signed GET URL"| R2Private

    %% Public Storage Flow
    Client -->|"Upload ảnh bài đăng SELL"| Backend
    Backend -->|"Lưu trữ ảnh sản phẩm"| R2Public
    Client -->|"Đọc ảnh sản phẩm tối ưu cache"| CloudflareCDN
    CloudflareCDN --> R2Public
```

1. **Private Bucket (`campus-marketplace-private`):**
   - Chứa ảnh thẻ sinh viên (`student_evidences.card_image_ref`) và tệp đính kèm trò chuyện (`attachments.storage_key`).
   - Mọi quyền truy cập bắt buộc thông qua **Short-lived Presigned URLs** (thời hạn 5–15 phút do backend sinh ra).
   - Tệp đính kèm tin nhắn tự động áp dụng vòng đời lưu trữ (Lifecycle TTL: 90 ngày).
2. **Public CDN Bucket (`campus-marketplace-public`):**
   - Chứa ảnh sản phẩm tin đăng bán (`post_images.storage_key`).
   - Phân phối toàn cầu qua Cloudflare CDN, nén ảnh định dạng WebP và tối ưu cache trình duyệt.

### 7.2. Giao tiếp Thời gian thực (Socket.IO Realtime Gateway)

- **Endpoint:** `/ws`
- **Xác thực Handshake:** Token JWT gửi qua `auth: { token: "Bearer <token>" }` trong handshake payload; không truyền qua Query Parameter để tránh bị ghi nhận trong web server access logs.
- **Phân quyền kết nối:** Chỉ tài khoản có `verificationStatus = 'APPROVED'` mới được kết nối và tham gia phòng chat.
- **Danh mục Sự kiện Thời gian thực (Realtime Events):**
  - `message.created`: Phát sinh khi có tin nhắn mới trong phòng chat `conversation_{id}`.
  - `notification.created`: Bắn thông báo đẩy cá nhân tới người dùng `user_{id}` khi có tương tác (tin đối ứng mới, kết quả duyệt thẻ).
  - `report.updated`: Cập nhật trạng thái xử lý khiếu nại báo cáo cho các bên liên quan.

---

## 8. Security (Bảo mật, Phân quyền & Bảo vệ Dữ liệu)

### 8.1. Ma trận Phân quyền Truy cập (Role-Based Access Control - RBAC)

Quyền hạn trong hệ thống được kiểm soát nghiêm ngặt theo vai trò (`role`) và trạng thái định danh (`verificationStatus`):

| Nhóm chức năng / Endpoint                     | GUEST (Chưa login) |    PENDING (Chờ duyệt thẻ)     |  APPROVED (Đã duyệt)  | ADMIN (Quản trị viên) |
| :-------------------------------------------- | :----------------: | :----------------------------: | :-------------------: | :-------------------: |
| **Xem bảng tin công khai (`GET /feed`)**      |      Giới hạn      | Có (`PendingFeedPage` rút gọn) | Có (Feed cá nhân hóa) |      Toàn quyền       |
| **Xem chi tiết bài đăng (`GET /posts/{id}`)** |   ❌ Chặn (401)    |       ❌ **Chặn (403)**        |      ✅ Cho phép      |      ✅ Cho phép      |
| **Mở xem số điện thoại người bán**            |   ❌ Chặn (401)    |         ❌ Chặn (403)          |  ✅ Cho phép (BR-08)  |      ✅ Cho phép      |
| **Đăng tin (`SELL` / `BUY_REQUEST`)**         |   ❌ Chặn (401)    |         ❌ Chặn (403)          |      ✅ Cho phép      |      ✅ Cho phép      |
| **Nhắn tin trò chuyện (`/conversations`)**    |   ❌ Chặn (401)    |         ❌ Chặn (403)          |      ✅ Cho phép      |   ❌ Không tham gia   |
| **Tạo báo cáo vi phạm (`POST /reports`)**     |   ❌ Chặn (401)    |         ❌ Chặn (403)          |      ✅ Cho phép      |      ✅ Cho phép      |
| **Xét duyệt thẻ SV & Xem ảnh thẻ**            |   ❌ Chặn (401)    |         ❌ Chặn (403)          |     ❌ Chặn (403)     |   ✅ **CHỈ ADMIN**    |
| **Quản trị người dùng & Phân xử báo cáo**     |   ❌ Chặn (401)    |         ❌ Chặn (403)          |     ❌ Chặn (403)     |   ✅ **CHỈ ADMIN**    |

### 8.2. Các Chỉ thị An toàn Bảo mật Tối cao (Security Directives)

1. **Bảo vệ Minh chứng Thẻ Sinh viên (BR-03):** Sau khi upload thành công, ảnh thẻ sinh viên (`card_image_ref`) là dữ liệu tối mật. Endpoint thông tin tài khoản `GET /me` hoàn toàn không trả về `cardImageRef`. Người dùng không thể xem lại ảnh thẻ sau khi nộp. **Chỉ duy nhất Admin** mới được cấp signed URL tạm thời để thẩm định (`GET /api/v1/admin/verifications/{id}`).
2. **Che giấu Số Điện thoại Người bán (BR-07 / BR-08):** API chi tiết bài đăng không chứa số điện thoại người bán. Chỉ khi người mua `APPROVED` chủ động bấm nút "Xem số điện thoại", hệ thống mới gọi `POST /posts/{id}/reveal-phone`, kiểm tra quyền hạn, ghi nhật ký vào `phone_reveal_events` và trả số điện thoại.
3. **An toàn Kết nối Cơ sở Dữ liệu (TLS Enforcement):** Mọi kết nối tới PostgreSQL Supabase Pooler bắt buộc bật xác thực chứng chỉ số TLS (`rejectUnauthorized: true`). Nghiêm cấm tắt kiểm tra chứng chỉ trong môi trường phát triển và sản xuất.
4. **Bảo vệ Thông tin Lỗi Máy chủ (HTTP 500 Safe Guard):** Mọi ngoại lệ không mong muốn phát sinh tại backend (lỗi kết nối CSDL, crash runtime, SQL syntax error) đều bị chặn lại tại `AllExceptionsFilter`. Response gửi cho client bắt buộc trả về `code: "INTERNAL_SERVER_ERROR"` và `message: "Internal server error"`, tuyệt đối không tiết lộ stack trace hay câu lệnh SQL ra môi trường bên ngoài; server logs tự động lọc sạch thông tin nhạy cảm qua hàm `sanitizeLogMessage`.

---

## 9. Development Convention (Quy chuẩn Phát triển, Gitflow & DoD)

### 9.1. Quy chuẩn Gitflow Workflow

Dự án vận hành theo mô hình phân nhánh Gitflow chuẩn:

```mermaid
gitGraph
    commit id: "Initial Commit"
    branch develop
    checkout develop
    commit id: "Setup Monorepo"
    branch feat/be-auth
    checkout feat/be-auth
    commit id: "feat: implement otp flow"
    commit id: "test: add auth e2e"
    checkout develop
    merge feat/be-auth id: "Merge PR #1 into develop"
    branch release/v1.0.0
    checkout release/v1.0.0
    commit id: "chore: bump version v1.0.0"
    checkout main
    merge release/v1.0.0 tag: "v1.0.0" id: "Deploy Production"
    checkout develop
    merge release/v1.0.0 id: "Sync release to develop"
```

- **Nhánh vĩnh viễn:**
  - `main`: Chứa mã nguồn ổn định sẵn sàng phát hành production, luôn gắn tag phiên bản (`v1.0.0`).
  - `develop`: Nhánh tích hợp mặc định cho toàn bộ hoạt động phát triển tính năng mới.
- **Nhánh hỗ trợ:**
  - `feat/fe-<tên-tính-năng>`: Nhánh tính năng Frontend rẽ từ `develop`.
  - `feat/be-<tên-tính-năng>`: Nhánh tính năng Backend rẽ từ `develop`.
  - `fix/<mô-tả-lỗi>`: Vá lỗi phát sinh rẽ từ `develop`.
  - `release/vX.Y.Z`: Chuẩn bị phát hành, merge vào cả `main` và `develop`.
  - `hotfix/<mô-tả-lỗi>`: Vá lỗi khẩn cấp trực tiếp từ `main`.

### 9.2. Quy chuẩn Quy ước Đặt tên (Naming Conventions)

| Thành phần              | Quy ước đặt tên                 | Ví dụ thực tế                                               |
| :---------------------- | :------------------------------ | :---------------------------------------------------------- |
| **Files & Folders**     | `kebab-case`                    | `transform.interceptor.ts`, `auth-session.response.ts`      |
| **TypeScript Classes**  | `PascalCase`                    | `TransformInterceptor`, `AllExceptionsFilter`, `ApiClient`  |
| **Interfaces & Types**  | `PascalCase`                    | `ApiResponse<T>`, `PageMeta`, `ErrorEnvelope`               |
| **Functions & Methods** | `camelCase`                     | `requestPaginated()`, `sanitizeLogMessage()`, `verifyOtp()` |
| **Constants & Enums**   | `UPPER_SNAKE_CASE`              | `POST_STATUS_ACTIVE`, `MAX_OTP_ATTEMPTS`, `PAGE_LIMIT`      |
| **Database Tables**     | `snake_case` (số nhiều)         | `users`, `student_evidences`, `posts`, `reputation_events`  |
| **Database Columns**    | `snake_case`                    | `school_email`, `verification_status`, `reputation_score`   |
| **API Endpoints**       | `kebab-case` (danh từ số nhiều) | `/api/v1/posts/{id}/reveal-phone`, `/api/v1/me/preferences` |

### 9.3. Tiêu chuẩn Hoàn thành (Definition of Done - DoD)

Một nhiệm vụ chỉ được coi là hoàn tất khi thỏa mãn đầy đủ các điều kiện sau:

1. **Type Safety & Lint:** TypeScript biên dịch không lỗi (`pnpm typecheck`), ESLint không vi phạm (`pnpm lint` với `--max-warnings 0`).
2. **Automated Testing:** 100% tests vượt qua trên môi trường cô lập:
   - Backend Unit Tests: `pnpm --filter @campus/backend test`
   - Backend E2E Tests: `pnpm --filter @campus/backend test:e2e`
   - Frontend Tests: `pnpm --filter @campus/frontend test`
3. **Build Success:** Toàn bộ ứng dụng và gói thư viện build thành công cho production (`pnpm build`).
4. **Contract Adherence:** Khớp 100% với schema OpenAPI v1.2 (`additionalProperties: false`), Success Envelope đối xứng và Error Envelope chuẩn.
5. **Security Enforced:** Không lộ secrets/passwords, Remote DB bắt buộc kiểm tra TLS chứng chỉ số.
6. **Traceability:** Ghi nhận đầy đủ vào `tasks/AGENT_HANDOFF.md` và tạo PR theo đúng mẫu `.github/pull_request_template.md`.
