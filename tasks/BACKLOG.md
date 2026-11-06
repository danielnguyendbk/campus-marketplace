# Campus Marketplace - Product & Technical Backlog

Tài liệu này là Backlog kỹ thuật và lộ trình thực thi chính thức của dự án **Campus Marketplace**, được thiết kế cho mô hình nhóm Backend 2 thành viên: **BE-01 (Backend Tech Lead)** và **BE-02 (Backend Developer)**, phối hợp song song với Frontend Team theo chuẩn Gitflow.

---

## 1. Phân định Trách nhiệm Cốt lõi & Shared Kernel

Toàn bộ hệ thống Backend được phân rã theo **Vertical Slice Architecture** với nguyên tắc triệt tiêu phụ thuộc chặn (non-blocking) và phân định quyền sở hữu rõ ràng:

- **BE-01 (Backend Tech Lead):**
  - Identity, Authentication (OTP, Register, Login, JWT Session).
  - Security Core: Password Hashing (Bcrypt), Core Guards (`JwtAuthGuard`, `RolesGuard`, `VerificationGuard`), RBAC, Rate Limiting.
  - Privacy: Controlled Phone Reveal Flow (`phone_reveal_events`), bảo vệ số điện thoại và dữ liệu nhạy cảm.
  - Realtime Core: Socket.IO Gateway (`/ws`), Handshake Auth, Room Isolation, Chat Event Stream Broadcaster.
  - Chat Domain: Conversations, Messages, Attachments & Presigned Download URL.
  - Architectural Governance: Database migrations, CI/CD, OpenAPI contract, code review và merge PR.
- **BE-02 (Backend Developer):**
  - Student Verification: Evidence Submission (`POST /me/evidence`), Admin Verification Review (`/admin/verifications`).
  - Marketplace Core: Categories & Seeds, Post CRUD (Tin bán `SELL` & Tin tìm mua `BUY_REQUEST`), Post Images (Cloudflare R2), Post Lifecycle State Transitions.
  - Discovery: Tiered Feed (`GET /feed` cho GUEST/PENDING vs APPROVED), Post Matching Engine.
  - Trust & Safety: Report Lifecycle 6-State Engine, Reputation Event Calculation Engine ($K=3$, $-0.1$).
  - Admin & Governance: Admin User Management, Admin Reports Decision, Audit Logs, System Configs, In-app Notifications.
- **Shared Kernel (Giao diện chốt trước trong Sprint 1):**
  1. `AuthenticatedUser` interface gắn trong `req.user` (`id`, `schoolEmail`, `role`, `verificationStatus`).
  2. Stub signatures của `JwtAuthGuard`, `RolesGuard`, `VerificationGuard` (BE-02 dùng mock trong Sprint 1, tích hợp guard thật khi BE-01 hoàn thành).
  3. `IStorageService` (S3/R2 presigned URL interface).
  4. `IRealtimeService` (Event emitter interface cho WebSocket).

---

## 2. Phase 0: Repository Bootstrap & Foundation (Hoàn thành)

- [x] **BOOTSTRAP-01:** Khởi tạo Monorepo với pnpm workspace (`apps/frontend`, `apps/backend`, `packages/api-contract`).
- [x] **BOOTSTRAP-02:** Đồng bộ Baseline Database Schema v1.2 (18 bảng) vào `database/baseline/schema_v1.2.sql`.
- [x] **BOOTSTRAP-03:** Đồng bộ OpenAPI 3.x contract v1.2 (49 endpoints) vào `packages/api-contract/openapi.yaml`.
- [x] **BOOTSTRAP-04:** Thiết lập quy chế AI Agent (`AGENTS.md` ở Root, Frontend, Backend, Database).
- [x] **BOOTSTRAP-05:** Cấu hình CI/CD GitHub Actions kiểm tra Lint, Test, Typecheck, Build.
- [x] **BOOTSTRAP-06:** Khởi tạo và hoàn tất ứng dụng Frontend Next.js 14+ (App Router) + React 18 + TypeScript chạy được kèm Vitest suites (chốt theo quyết định công nghệ của nhóm).
- [x] **BOOTSTRAP-07:** Khởi tạo ứng dụng Backend NestJS 10 + TypeScript với `GET /health` và SQL-first PostgreSQL pool layer.
- [x] **BOOTSTRAP-08:** Chuẩn hóa Success Envelope `{ success: true, data, [meta], timestamp }` và Error Envelope theo OpenAPI v1.2 (`additionalProperties: false`).
- [x] **BOOTSTRAP-09:** Cơ chế an toàn lỗi HTTP 500 (`INTERNAL_SERVER_ERROR`), giấu stack trace và sanitize log nhạy cảm.
- [x] **BOOTSTRAP-10:** Xây dựng tài liệu Kiến trúc Kỹ thuật Toàn diện 9 phần (`docs/ARCHITECTURE.md`).

---

## 3. Bảng Phân công Toàn bộ Backend (Task Master Matrix)

Ánh xạ toàn diện giữa Task Backend, WBS Cấp 3 (từ tài liệu `Campus_Marketplace_WBS_v0.3_DBML_Review.xlsx`), Jira Story và 17 Functional Requirements Must (FR-01 → FR-17):

| Task ID       | Task Name                                       |   Owner   | Sprint | Priority | WBS   | Jira   | FR Ref       | Dependencies           | API Endpoints                                                                                                               | Database Tables                                     |  SP   |
| :------------ | :---------------------------------------------- | :-------: | :----: | :------: | :---: | :----: | :----------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- | :---: |
| **BE-01-T01** | Core Auth: OTP Mailer & Verify Ticket           | **BE-01** | **S1** |  **P0**  | 4.1.1 | CMP-6  | FR-01        | PR #1 Merged           | `POST /auth/request-otp`<br>`POST /auth/verify-otp`                                                                         | `otp_verifications`                                 | **5** |
| **BE-01-T02** | Core Auth: Register, Bcrypt & Login JWT         | **BE-01** | **S1** |  **P0**  | 4.1.1 | CMP-6  | FR-01        | BE-01-T01              | `POST /auth/register`<br>`POST /auth/login`                                                                                 | `users`                                             | **5** |
| **BE-01-T03** | Security: Core Guards & RBAC System             | **BE-01** | **S1** |  **P0**  | 4.1.3 | CMP-18 | FR-04        | BE-01-T02              | Middleware / Guards toàn hệ thống                                                                                           | `users`                                             | **5** |
| **BE-01-T04** | User Domain: Profile & Preferences CRUD         | **BE-01** | **S1** |  **P1**  | 4.1.4 | CMP-21 | FR-05        | BE-01-T03              | `GET/PATCH /me`<br>`GET/PATCH /me/preferences`                                                                              | `users`<br>`user_preferences`                       | **3** |
| **BE-01-T05** | Privacy: Controlled Phone Reveal Flow           | **BE-01** | **S2** |  **P0**  | 4.3.3 | CMP-17 | FR-11, FR-13 | BE-01-T03<br>BE-02-T04 | `POST /posts/{id}/reveal-phone`                                                                                             | `phone_reveal_events`<br>`posts`, `sell_details`    | **3** |
| **BE-01-T06** | Chat Domain: Conversations Management           | **BE-01** | **S2** |  **P0**  | 4.3.1 | CMP-15 | FR-10        | BE-01-T03<br>BE-02-T04 | `POST /conversations`<br>`GET /conversations`                                                                               | `conversations`<br>`posts`, `users`                 | **5** |
| **BE-01-T07** | Chat Domain: Messages & Attachments Handling    | **BE-01** | **S2** |  **P0**  | 4.3.2 | CMP-16 | FR-11        | BE-01-T06              | `GET/POST /conversations/{id}/messages`<br>`POST .../attachments`<br>`GET .../download`                                     | `messages`<br>`attachments`                         | **5** |
| **BE-01-T08** | Realtime Core: Socket.IO Gateway & Auth         | **BE-01** | **S3** |  **P0**  | 4.3.1 | CMP-15 | FR-10        | BE-01-T03<br>BE-01-T06 | WebSocket `/ws`<br>(Connection & Handshake)                                                                                 | `users`<br>`conversations`                          | **5** |
| **BE-01-T09** | Realtime Events: Message/Notice/Report Stream   | **BE-01** | **S3** |  **P0**  | 4.4.5 | CMP-25 | FR-10, FR-17 | BE-01-T08              | WebSocket `/ws`<br>(Event Dispatchers)                                                                                      | Không phụ thuộc bảng                                | **5** |
| **BE-01-T10** | Hardening: Rate Limiting & Retention Jobs (DB06)| **BE-01** | **S4** |  **P1**  | 4.3.4 | CMP-22 | FR-12        | BE-01-T07<br>BE-01-T09 | Toàn bộ API nhạy cảm & Cronjob                                                                                              | `attachments`<br>`messages`                         | **3** |
| **BE-02-T01** | Student Verification: Evidence Submission       | **BE-02** | **S1** |  **P0**  | 4.1.2 | CMP-7  | FR-02        | Shared Stub            | `POST /me/evidence`<br>`GET /me/verification`                                                                               | `student_evidences`<br>`users`                      | **5** |
| **BE-02-T02** | Student Verification: Admin Review & Presigned  | **BE-02** | **S1** |  **P0**  | 4.1.3 | CMP-8  | FR-03        | BE-02-T01              | `GET /admin/verifications`<br>`GET/PATCH .../verifications/{id}`                                                            | `student_evidences`<br>`users`                      | **5** |
| **BE-02-T03** | Marketplace: Categories & Baseline Seeding      | **BE-02** | **S1** |  **P1**  | 4.2.1 | CMP-9  | FR-06        | PR #1 Merged           | `GET /categories`                                                                                                           | `categories`                                        | **3** |
| **BE-02-T04** | Marketplace: Post CRUD (SELL & BUY_REQUEST)     | **BE-02** | **S2** |  **P0**  | 4.2.1 | CMP-9  | FR-06, FR-07 | BE-02-T03<br>BE-01-T03 | `POST /posts`, `GET /posts`<br>`GET /me/posts`, `PATCH /posts/{id}`                                                         | `posts`, `sell_details`<br>`buy_request_details`    | **8** |
| **BE-02-T05** | Marketplace: Post Lifecycle State Transitions   | **BE-02** | **S2** |  **P1**  | 4.2.1 | CMP-10 | FR-06, FR-07 | BE-02-T04              | `POST /posts/{id}/hide`<br>`activate`, `sold`, `close`                                                                      | `posts`                                             | **3** |
| **BE-02-T06** | Media Storage: Post Images Upload & Deletion    | **BE-02** | **S2** |  **P1**  | 4.2.1 | CMP-11 | FR-06        | BE-02-T04              | `POST /posts/{id}/images`<br>`DELETE .../images/{imageId}`                                                                  | `post_images`                                       | **3** |
| **BE-02-T07** | Discovery: Tiered Feed & Matching Engine        | **BE-02** | **S3** |  **P0**  | 4.2.3 | CMP-12 | FR-08, FR-09 | BE-02-T04<br>BE-01-T04 | `GET /feed`<br>`GET /posts/{id}/matches`                                                                                    | `posts`, `sell_details`<br>`user_preferences`       | **5** |
| **BE-02-T08** | Trust & Safety: Report Lifecycle 6-State Engine | **BE-02** | **S3** |  **P0**  | 4.4.1 | CMP-19 | FR-13, FR-14 | BE-02-T04<br>BE-01-T03 | `POST /reports`, `GET /me/reports`<br>`GET /reports/{id}`, `POST .../seller-resp`                                           | `reports`                                           | **5** |
| **BE-02-T09** | Trust & Safety: Reputation Calculation Engine   | **BE-02** | **S3** |  **P0**  | 4.4.4 | CMP-24 | FR-16        | BE-02-T08              | `GET /admin/reputation-events`                                                                                              | `reputation_events`<br>`users`                      | **5** |
| **BE-02-T10** | Admin & Governance: Users, Audit & Configs      | **BE-02** | **S4** |  **P1**  | 4.4.3 | CMP-20 | FR-15, FR-17 | BE-02-T08<br>BE-01-T03 | `GET /admin/users`, `PATCH .../status`<br>`GET /admin/reports`, `PATCH ...`<br>`GET /admin/audit-logs`, `GET/PATCH configs` | `audit_logs`<br>`system_configs`<br>`notifications` | **5** |

_Tổng Story Points: 89 SP (Phân bổ đồng đều ~11 SP / người / sprint 2 tuần, tương ứng tiến độ 6 tuần W1–W6)._

---

## 4. Chi tiết 4 Sprints Backend (Chi tiết 20 Tasks Kỹ thuật)

### Sprint 1: Identity, Foundation & Evidence Verification

> **Mục tiêu:** Xây dựng lõi xác thực sinh viên, hệ thống Guards, nộp minh chứng thẻ SV và danh mục dữ liệu mẫu. Kết thúc Sprint 1 đạt Milestone 1: Sinh viên có thể đăng ký, đăng nhập, nộp ảnh thẻ và Admin có thể duyệt thẻ.

#### BE-01 (Backend Tech Lead)

- [ ] **BE-01-T01: Core Auth — University Email OTP Dispatcher & Verification** (P0, 5 SP)
  - **API:** `POST /auth/request-otp`, `POST /auth/verify-otp`.
  - **Database:** `otp_verifications` (`email`, `code_hash`, `expires_at`, `attempts`).
  - **Files:** `src/modules/auth/auth.controller.ts`, `auth.service.ts`, `repositories/otp.repository.ts`, `services/mail.service.ts`.
  - **Acceptance Criteria:** Regex domain trường (`.edu.vn`); OTP lưu băm SHA-256 (`code_hash`); hủy sau 5 lần sai; hạn 10 phút; trả `otpTicket` HMAC.
  - **Tests:** Unit test hash validation, rate limiting OTP test, E2E test full flow request -> verify.
  - **Branch:** `feat/be-01-auth-otp`
- [ ] **BE-01-T02: Core Auth — User Registration, Password Hashing & Login Session** (P0, 5 SP)
  - **API:** `POST /auth/register`, `POST /auth/login`.
  - **Database:** `users` (`id`, `school_email`, `password_hash`, `role`, `verification_status`).
  - **Files:** `src/modules/auth/dto/register.dto.ts`, `dto/login.dto.ts`, `strategies/jwt.strategy.ts`.
  - **Acceptance Criteria:** `bcrypt` với `saltRounds = 12`; mặc định `role = 'USER'`, `verification_status = 'PENDING'`, `reputation_score = 5.0`; trả về `AuthSessionResponse` gồm `accessToken` và `user`.
  - **Tests:** Unit test bcrypt compare, JWT sign/verify, E2E login thành công và sai mật khẩu.
  - **Branch:** `feat/be-01-auth-session`
- [ ] **BE-01-T03: Security & RBAC — Core Guards, Roles & Verification Enforcer** (P0, 5 SP)
  - **API:** Middleware & Guards xuyên suốt toàn hệ thống.
  - **Database:** `users` (`role`, `verification_status`).
  - **Files:** `src/common/guards/jwt-auth.guard.ts`, `roles.guard.ts`, `verification.guard.ts`, `decorators/current-user.decorator.ts`.
  - **Acceptance Criteria:** `JwtAuthGuard` giải mã Bearer Token gắn `req.user`; `RolesGuard` thẩm định ADMIN/USER; `VerificationGuard` từ chối `PENDING` vào API yêu cầu `APPROVED` với HTTP 403; `SUSPENDED` bị chặn toàn diện.
  - **Tests:** Unit test từng guard với mock context; test 401 khi thiếu token, 403 khi sai role/status.
  - **Branch:** `feat/be-01-security-guards`
- [ ] **BE-01-T04: User Domain — Profile & Preferences Management** (P1, 3 SP)
  - **API:** `GET /me`, `PATCH /me`, `GET /me/preferences`, `PATCH /me/preferences`.
  - **Database:** `users`, `user_preferences`.
  - **Files:** `src/modules/user/user.controller.ts`, `user.service.ts`, `repositories/user.repository.ts`.
  - **Acceptance Criteria:** `GET /me` tuyệt đối không trả `password_hash` và `card_image_ref` (BR-03); `PATCH /me` chỉ sửa `displayName`, `phoneNumber`, `province`; hỗ trợ `favoriteCategoryIds` và `interestKeywords`.
  - **Tests:** Contract test `MeResponse`, unit test update profile, negative test cố tình sửa `role`.
  - **Branch:** `feat/be-01-user-profile`

#### BE-02 (Backend Developer)

- [ ] **BE-02-T01: Student Verification — Evidence Submission & In-Flight Status** (P0, 5 SP)
  - **API:** `POST /me/evidence`, `GET /me/verification`.
  - **Database:** `student_evidences`, `users`.
  - **Files:** `src/modules/verification/verification.controller.ts`, `verification.service.ts`, `repositories/evidence.repository.ts`.
  - **Acceptance Criteria:** Upload ảnh (`jpg`, `png` $\le 5\text{MB}$); lưu Private R2 Bucket; lưu `card_image_ref`; `verification_status = 'PENDING'`; `GET /me/verification` tuyệt đối không trả link ảnh thẻ ra ngoài.
  - **Tests:** Unit test upload validation, contract test `VerificationResponse`, E2E nộp minh chứng.
  - **Branch:** `feat/be-02-evidence-submit`
- [ ] **BE-02-T02: Student Verification — Admin Review & Evidence Approval** (P0, 5 SP)
  - **API:** `GET /admin/verifications`, `GET /admin/verifications/{id}`, `PATCH /admin/verifications/{id}`.
  - **Database:** `student_evidences`, `users`, `audit_logs`.
  - **Files:** `src/modules/verification/admin-verification.controller.ts`, `services/admin-verification.service.ts`.
  - **Acceptance Criteria:** Yêu cầu `role = 'ADMIN'`; `GET .../{id}` sinh Short-lived Presigned GET URL (15 phút); `PATCH` cập nhật `APPROVED` hoặc `REJECTED` (kèm `rejectionReason`); bắt buộc ghi `audit_logs`.
  - **Tests:** Contract test `AdminVerificationResponse`, E2E test duyệt thẻ SV và kiểm tra audit log.
  - **Branch:** `feat/be-02-admin-verification`
- [ ] **BE-02-T03: Marketplace Core — Category Management & Baseline Seeding** (P1, 3 SP)
  - **API:** `GET /categories`.
  - **Database:** `categories`.
  - **Files:** `src/modules/category/category.controller.ts`, `category.service.ts`, `database/seeds/category.seed.ts`.
  - **Acceptance Criteria:** Nạp đủ `TEXTBOOK`, `ELECTRONICS`, `FURNITURE`, `APPLIANCES`, `OTHER`; trả về phân trang root-level `CategoryPage` có `meta` và `sort_order`; Public API cho GUEST.
  - **Tests:** Unit test CategoryService, contract test `CategoryPage` root-level metadata.
  - **Branch:** `feat/be-02-category-seed`

---

### Sprint 2: Commerce Lifecycle, Privacy & Chat Data Layer

> **Mục tiêu:** Mở rộng Marketplace với luồng đăng tin bán đồ cũ, tin tìm mua, ảnh sản phẩm; đồng thời mở hội thoại chat gắn trực tiếp vào tin đăng và kiểm soát mở số điện thoại người bán. Kết thúc Sprint 2 đạt Milestone 2.

#### BE-01 (Backend Tech Lead)

- [ ] **BE-01-T05: Privacy & Security — Controlled Phone Reveal Flow** (P0, 3 SP)
  - **API:** `POST /posts/{id}/reveal-phone`.
  - **Database:** `phone_reveal_events`, `posts`, `sell_details`, `users`.
  - **Files:** `src/modules/posts/phone-reveal.controller.ts`, `services/phone-reveal.service.ts`.
  - **Acceptance Criteria:** Chỉ tài khoản `APPROVED` mới được xem; bài đăng phải ở trạng thái `ACTIVE` (hoặc `HIDDEN` với chính chủ); ghi bản ghi `phone_reveal_events`; trả về số điện thoại định dạng E.164.
  - **Tests:** E2E test chặn GUEST/PENDING, test ghi nhận lịch sử mở số, test bài đăng closed/sold trả 400.
  - **Branch:** `feat/be-01-phone-reveal`
- [ ] **BE-01-T06: Chat Domain — Conversations Management & Access Boundaries** (P0, 5 SP)
  - **API:** `POST /conversations`, `GET /conversations`, `GET /conversations/{id}`.
  - **Database:** `conversations`, `posts`, `users`.
  - **Files:** `src/modules/chat/chat.controller.ts`, `chat.service.ts`, `repositories/conversation.repository.ts`.
  - **Acceptance Criteria:** Chặn người mua tự tạo hội thoại với chính mình (`buyer_id != seller_id`); idempotent nếu đã có hội thoại `OPEN` cùng `post_id`; `GET /conversations` trả `ConversationPage` có `meta` và `canSend = true`.
  - **Tests:** Unit test tạo conversation, kiểm tra chặn buyer = seller, E2E list conversations.
  - **Branch:** `feat/be-01-chat-conversations`
- [ ] **BE-01-T07: Chat Domain — Messages & Secure Attachments Handling** (P0, 5 SP)
  - **API:** `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, `POST .../attachments`, `GET .../download`.
  - **Database:** `messages`, `attachments`, `conversations`.
  - **Files:** `src/modules/chat/messages.service.ts`, `repositories/message.repository.ts`, `services/attachment.service.ts`.
  - **Acceptance Criteria:** Chỉ thành viên cuộc trò chuyện được gửi/đọc tin; tệp đính kèm lưu Private R2 Bucket, thời gian lưu trữ (TTL) 1 tháng (~30 ngày từ message.created_at); tin nhắn văn bản lưu 3 tháng (~90 ngày) theo quyết định DB06 & FR-12; API download sinh Signed GET URL (hạn 15 phút), từ chối nếu quá hạn.
  - **Tests:** Unit test membership check, contract test `MessagePage`, E2E test upload attachment.
  - **Branch:** `feat/be-01-chat-messages`

#### BE-02 (Backend Developer)

- [ ] **BE-02-T04: Marketplace Core — Post CRUD (SELL & BUY_REQUEST Engines)** (P0, 8 SP)
  - **API:** `POST /posts`, `GET /posts`, `GET /posts/{id}`, `PATCH /posts/{id}`, `GET /me/posts`.
  - **Database:** `posts`, `sell_details`, `buy_request_details`, `categories`, `users`.
  - **Files:** `src/modules/posts/posts.controller.ts`, `posts.service.ts`, `repositories/post.repository.ts`.
  - **Acceptance Criteria:** Chỉ tài khoản `APPROVED` mới được đăng bài; bài `SELL` bắt buộc có `price > 0`, `condition` và ít nhất 1 ảnh; bài `BUY_REQUEST` có `budget_min <= budget_max`; `GET /posts/{id}` chỉ cho `APPROVED` xem chi tiết (BR-01).
  - **Tests:** Unit test validation SELL/BUY, transaction rollback test, E2E test chặn PENDING xem chi tiết.
  - **Branch:** `feat/be-02-post-crud`
- [ ] **BE-02-T05: Marketplace Core — Post Lifecycle State Transitions** (P1, 3 SP)
  - **API:** `POST /posts/{id}/hide`, `POST /posts/{id}/activate`, `POST /posts/{id}/sold`, `POST /posts/{id}/close`.
  - **Database:** `posts`.
  - **Files:** `src/modules/posts/post-lifecycle.service.ts`.
  - **Acceptance Criteria:** Chỉ chủ bài đăng (hoặc ADMIN) mới được đổi trạng thái; tuân thủ nghiêm ngặt State Machine; tin đã `SOLD` hoặc `CLOSED` không thể kích hoạt lại thành `ACTIVE`.
  - **Tests:** Unit test state machine transitions, negative test thao tác trái quyền của user khác.
  - **Branch:** `feat/be-02-post-lifecycle`
- [ ] **BE-02-T06: Media Storage — Post Images Upload & Deletion Engine** (P1, 3 SP)
  - **API:** `POST /posts/{id}/images`, `DELETE /posts/{id}/images/{imageId}`.
  - **Database:** `post_images`, `posts`.
  - **Files:** `src/modules/posts/post-images.controller.ts`, `services/post-images.service.ts`.
  - **Acceptance Criteria:** Upload ảnh lên Public R2 Bucket; giới hạn tối đa 5 ảnh / bài đăng; lưu `public_url` và `sort_order`; xóa ảnh cập nhật lại `sort_order` liên tục.
  - **Tests:** Unit test giới hạn 5 ảnh, E2E upload/delete ảnh bài đăng.
  - **Branch:** `feat/be-02-post-images`

---

### Sprint 3: Realtime WebSocket Gateway & Trust/Safety Engine

> **Mục tiêu:** Đưa hệ thống chat lên thời gian thực qua WebSocket Gateway (`/ws`), đồng thời hoàn thiện động cơ báo cáo vi phạm 6 trạng thái và trừ điểm uy tín tự động. Kết thúc Sprint 3 đạt Milestone 3.

#### BE-01 (Backend Tech Lead)

- [ ] **BE-01-T08: Realtime Core — Socket.IO Gateway & Handshake Auth** (P0, 5 SP)
  - **API:** WebSocket Gateway `/ws` (`connect`, `disconnect`, `join_conversation`, `leave_conversation`).
  - **Database:** `users`, `conversations`.
  - **Files:** `src/modules/realtime/realtime.gateway.ts`, `guards/ws-auth.guard.ts`, `adapters/socket-io.adapter.ts`.
  - **Acceptance Criteria:** Handshake chỉ đọc token từ `auth.token` hoặc `headers.authorization`; tuyệt đối cấm query token; ngắt kết nối nếu token sai hoặc `verification_status != 'APPROVED'`; tự động vào room `user_{id}`; `join_conversation` kiểm tra thành viên trước khi vào room `conversation_{id}`.
  - **Tests:** E2E WebSocket test với `socket.io-client`: verify handshake thành công, chặn token rác, chặn PENDING.
  - **Branch:** `feat/be-01-realtime-gateway`
- [ ] **BE-01-T09: Realtime Events — Message/Notice/Report Stream Broadcaster** (P0, 5 SP)
  - **API:** WebSocket Events: `message.created`, `notification.created`, `report.updated`.
  - **Database:** Không phụ thuộc trực tiếp.
  - **Files:** `src/modules/realtime/realtime.service.ts`, `interfaces/realtime-events.interface.ts`.
  - **Acceptance Criteria:** Method `emitToConversation(conversationId, event, data)` gửi tin nhắn đến room; `emitToUser(userId, event, data)` gửi thông báo riêng; payload chuẩn theo type definitions trong `ARCHITECTURE.md`.
  - **Tests:** Unit test `RealtimeService` mock Socket.IO server, E2E broadcast tin nhắn nhận được trên 2 clients.
  - **Branch:** `feat/be-01-realtime-events`

#### BE-02 (Backend Developer)

- [ ] **BE-02-T07: Discovery — Tiered Feed & Matching Engine** (P0, 5 SP)
  - **API:** `GET /feed`, `GET /posts/{id}/matches`.
  - **Database:** `posts`, `sell_details`, `buy_request_details`, `user_preferences`.
  - **Files:** `src/modules/feed/feed.controller.ts`, `feed.service.ts`, `services/matching.service.ts`.
  - **Acceptance Criteria:** `GET /feed` cho `PENDING` chỉ trả danh sách rút gọn `PendingFeedPage` (không link chi tiết, không SĐT); `GET /feed` cho `APPROVED` trả `PostPage` cá nhân hóa theo preferences; `matches` tìm tin đối ứng theo `categoryId`, khu vực (`province`), và ngân sách `[budget_min, budget_max]`.
  - **Tests:** Unit test matching algorithm, E2E test feed response format cho cả PENDING và APPROVED.
  - **Branch:** `feat/be-02-feed-matching`
- [ ] **BE-02-T08: Trust & Safety — Report Lifecycle & 6-State Machine Engine** (P0, 5 SP)
  - **API:** `POST /reports`, `GET /me/reports`, `GET /reports/{id}`, `POST /reports/{id}/seller-response`.
  - **Database:** `reports`, `posts`, `users`.
  - **Files:** `src/modules/trust/reports.controller.ts`, `reports.service.ts`, `state/report-state-machine.ts`.
  - **Acceptance Criteria:** Báo cáo tạo mới `SUBMITTED`, hẹn giải trình 48h (`response_deadline_at = now() + 48h`) -> `WAITING_SELLER_RESPONSE`; chỉ seller bị báo cáo mới được gửi giải trình -> `UNDER_REVIEW`; quá 48h tự động đánh dấu `NO_RESPONSE`; bắn event realtime `report.updated` qua `RealtimeService`; thực thi Partial Unique Index `uq_active_report_per_buyer` (DB01) chặn tạo trùng báo cáo khi đang có báo cáo `WAITING_SELLER_RESPONSE` hoặc `UNDER_REVIEW`.
  - **Tests:** State machine unit tests, integration test kiểm tra hạn deadline 48h, contract test `ReportPage`.
  - **Branch:** `feat/be-02-report-lifecycle`
- [ ] **BE-02-T09: Trust & Safety — Reputation Event Calculation & Deduction Engine** (P0, 5 SP)
  - **API:** `GET /admin/reputation-events`.
  - **Database:** `reputation_events`, `users`, `reports`.
  - **Files:** `src/modules/trust/reputation.service.ts`, `repositories/reputation.repository.ts`.
  - **Acceptance Criteria:** Điểm khởi tạo 5.0; vi phạm hoặc `NO_RESPONSE` đạt ngưỡng chu kỳ $K=3$ trừ đúng `-0.1` điểm; chống trừ trùng lặp bằng `report_cycle_key`; chặn dưới tại 0.0; không tự động khóa tài khoản theo điểm (quyền thuộc Admin).
  - **Tests:** Unit test công thức trừ điểm, test chống trừ trùng bằng cycle key, boundary test tại 0.0.
  - **Branch:** `feat/be-02-reputation-engine`

---

### Sprint 4: Admin Governance, Hardening & Full Contract Verification

> **Mục tiêu:** Hoàn thiện bảng điều khiển quản trị Admin, Audit Logs, cấu hình hệ thống, cơ chế bảo mật nâng cao (Rate Limiting, Log Sanitizer, File Retention) và nghiệm thu 100% 49 endpoints đạt chuẩn DoD. Kết thúc Sprint 4 sẵn sàng cho Production Release (v1.0.0).

#### BE-01 (Backend Tech Lead)

- [ ] **BE-01-T10: System Hardening — Rate Limiting, Log Sanitizer & Chat Retention Jobs (DB06)** (P1, 3 SP)
  - **API:** Global Security Middlewares & Background Scheduled Jobs.
  - **Database:** `attachments`, `messages`, `otp_verifications`.
  - **Files:** `src/common/guards/throttle.guard.ts`, `src/jobs/cleanup-retention.job.ts`.
  - **Acceptance Criteria:** Rate limit: Tối đa 3 OTP / 10 phút / IP; tối đa 10 login / 5 phút / IP; Job 0h hàng ngày xóa mềm và kích hoạt xóa R2 cho file đính kèm (`attachments`) quá 1 tháng (30 ngày); đánh dấu/xóa tin nhắn văn bản (`messages`) quá 3 tháng (90 ngày) theo DB06 và FR-12; server log redact mật khẩu, tokens, chuỗi kết nối DB.
  - **Tests:** Unit test cronjob query, integration test rate limiter ném HTTP 429 Too Many Requests.
  - **Branch:** `feat/be-01-system-hardening`

#### BE-02 (Backend Developer)

- [ ] **BE-02-T10: Admin & Governance — Moderation, Audit Logs & System Configs** (P1, 5 SP)
  - **API:** `GET /admin/users`, `PATCH /admin/users/{id}/status`, `GET /admin/reports`, `PATCH /admin/reports/{id}`, `GET /admin/audit-logs`, `GET/PATCH /admin/configs/*`, `GET/PATCH /me/notifications/*`.
  - **Database:** `users`, `reports`, `audit_logs`, `system_configs`, `notifications`.
  - **Files:** `src/modules/admin/admin.controller.ts`, `admin.service.ts`, `src/modules/notification/notification.service.ts`.
  - **Acceptance Criteria:** Yêu cầu `role = 'ADMIN'`; khóa tài khoản (`SUSPENDED`) hủy phiên JWT và ghi `audit_logs`; phân xử báo cáo (`RESOLVED`/`DISMISSED`) bắt buộc `resolutionNote`; quản trị `system_configs` (ngưỡng $K$, hạn 48h); đọc thông báo `/notifications/{id}/read`.
  - **Tests:** Contract test toàn bộ Admin Pages (`AdminUserPage`, `AuditLogPage`, `SystemConfigPage`), E2E test phân xử báo cáo.
  - **Branch:** `feat/be-02-admin-governance`

---

## 5. Frontend Backlog (Tương ứng theo Giai đoạn)

- **Phase 1: Authentication & User Verification (FE)**
  - [ ] **FE-AUTH-01:** Màn hình Đăng ký / Xác thực OTP email sinh viên.
  - [ ] **FE-AUTH-02:** Màn hình Đăng nhập và lưu trữ phiên JWT.
  - [ ] **FE-AUTH-03:** Màn hình Gửi minh chứng sinh viên (Upload thẻ SV).
  - [ ] **FE-AUTH-04:** Giao diện phê duyệt minh chứng dành cho Admin.
- **Phase 2: Marketplace Listings & Post CRUD (FE)**
  - [ ] **FE-POST-01:** Trang chủ hiển thị danh sách bài đăng dạng lưới và bộ lọc danh mục.
  - [ ] **FE-POST-02:** Form đăng tin bán đồ cũ (chọn ảnh, nhập giá, chọn tình trạng hàng).
  - [ ] **FE-POST-03:** Form đăng tin tìm mua đồ dùng sinh viên.
  - [ ] **FE-POST-04:** Trang chi tiết bài đăng và thông tin người bán (gọi Reveal Phone).
- **Phase 3: Communication & Trust/Safety (FE)**
  - [ ] **FE-CHAT-01:** Giao diện nhắn tin trao đổi đồ cũ giữa sinh viên (WebSocket Socket.IO).
  - [ ] **FE-CHAT-02:** Upload tệp đính kèm và xem trước hình ảnh trong khung chat.
  - [ ] **FE-SAFETY-01:** Modal báo cáo tin đăng vi phạm.
  - [ ] **FE-SAFETY-02:** Giao diện giải trình dành cho người bán và xem điểm uy tín.
- **Phase 4: Admin Portal (FE)**
  - [ ] **FE-ADMIN-01:** Dashboard quản trị người dùng, khóa tài khoản và xem audit log.
  - [ ] **FE-ADMIN-02:** Bảng điều khiển phân xử báo cáo và cấu hình hệ thống.

---

## 6. GitHub Conventions & Quality Gate

### 1. Phân loại Labels trên GitHub

- **Người phụ trách:** `assignee:be-01` (Tech Lead), `assignee:be-02` (Developer).
- **Phân loại Sprint:** `sprint-1`, `sprint-2`, `sprint-3`, `sprint-4`.
- **Độ ưu tiên:** `priority:P0-blocker`, `priority:P1-high`, `priority:P2-normal`.
- **Phân vùng Domain:** `domain:auth-security`, `domain:marketplace`, `domain:chat-realtime`, `domain:trust-admin`.

### 2. Quy trình Phối hợp GitHub (Gitflow Workflow)

1. **Branch Naming:** `feat/be-01-<tên-task>` hoặc `feat/be-02-<tên-task>` (rẽ nhánh từ `develop`).
2. **Pull Request Protocol:**
   - BE-02 mở PR → **BE-01 (Tech Lead) bắt buộc là Reviewer chính**.
   - BE-01 mở PR → BE-02 review và kiểm tra tích hợp.
   - Chỉ được Merge vào `develop` khi: Có ít nhất 1 Approved Review + GitHub Actions CI màu xanh (PASS toàn bộ).
3. **Quyền hạn phê duyệt của Tech Lead (BE-01):**
   - Mọi thay đổi đụng tới `packages/api-contract/`, `.github/workflows/`, cấu hình kết nối DB (`src/config/`, `src/database/`) và `src/common/` **bắt buộc phải có chữ ký duyệt của BE-01**.

### 3. Tiêu chuẩn Hoàn thành (Definition of Done - DoD)

Một task chỉ được coi là hoàn tất khi:

1. **Clean Code & Type Safety:** `pnpm lint` 0 warnings, `pnpm typecheck` 0 errors.
2. **Automated Tests:** Tất cả unit tests và E2E tests liên quan đều PASS.
3. **Build Success:** `pnpm build` thành công cho production.
4. **Contract Adherence:** Khớp 100% với schema OpenAPI v1.2 (`additionalProperties: false`), Success Envelope đối xứng và Error Envelope chuẩn.
5. **Security Enforced:** Không lộ secrets/passwords, Remote DB bắt buộc kiểm tra TLS chứng chỉ số.
6. **Traceability:** Ghi nhận đầy đủ vào `tasks/AGENT_HANDOFF.md` và tạo PR theo đúng mẫu `.github/pull_request_template.md`.
