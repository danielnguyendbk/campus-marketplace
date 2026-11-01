CREATE TYPE "user_role" AS ENUM (
  'USER',
  'ADMIN'
);

CREATE TYPE "verification_status" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "otp_purpose" AS ENUM (
  'REGISTER'
);

CREATE TYPE "post_type" AS ENUM (
  'SELL',
  'BUY_REQUEST'
);

CREATE TYPE "post_status" AS ENUM (
  'ACTIVE',
  'HIDDEN',
  'SOLD',
  'CLOSED'
);

CREATE TYPE "conversation_status" AS ENUM (
  'OPEN',
  'ARCHIVED'
);

CREATE TYPE "message_type" AS ENUM (
  'TEXT',
  'ATTACHMENT'
);

CREATE TYPE "attachment_status" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'DELETED'
);

CREATE TYPE "report_reason_code" AS ENUM (
  'STALE_SOLD_POST',
  'MISLEADING_INFO',
  'INAPPROPRIATE_CONTENT',
  'OTHER'
);

CREATE TYPE "report_status" AS ENUM (
  'SUBMITTED',
  'WAITING_SELLER_RESPONSE',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'NO_RESPONSE'
);

CREATE TYPE "actor_type" AS ENUM (
  'USER',
  'SYSTEM'
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "school_email" varchar(255) UNIQUE NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "phone_number" varchar(20),
  "role" user_role NOT NULL DEFAULT 'USER',
  "verification_status" verification_status NOT NULL DEFAULT 'PENDING',
  "school" varchar(255),
  "major" varchar(255),
  "class_name" varchar(100),
  "student_code" varchar(50),
  "cohort" varchar(50),
  "province" varchar(100),
  "reputation_score" numeric(2,1) NOT NULL DEFAULT 5,
  "no_response_count" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "otp_verifications" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "email" varchar(255) NOT NULL,
  "code_hash" text NOT NULL,
  "purpose" otp_purpose NOT NULL DEFAULT 'REGISTER',
  "expires_at" timestamptz NOT NULL,
  "attempts" int NOT NULL DEFAULT 0,
  "verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "student_evidences" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "card_image_ref" text NOT NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT (now()),
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "reason" text
);

CREATE TABLE "categories" (
  "id" varchar(100) PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "user_preferences" (
  "user_id" uuid PRIMARY KEY,
  "favorite_category_ids" text[] NOT NULL DEFAULT ('{}'),
  "interest_keywords" text[] NOT NULL DEFAULT ('{}'),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "posts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "owner_id" uuid NOT NULL,
  "post_type" post_type NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "category_id" varchar(100) NOT NULL,
  "province" varchar(100) NOT NULL,
  "status" post_status NOT NULL DEFAULT 'ACTIVE',
  "close_reason" varchar(100),
  "ended_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "sell_details" (
  "post_id" uuid PRIMARY KEY,
  "price" numeric(15,2) NOT NULL,
  "condition" varchar(255) NOT NULL,
  "allow_phone_reveal" boolean NOT NULL DEFAULT true
);

CREATE TABLE "buy_request_details" (
  "post_id" uuid PRIMARY KEY,
  "budget_min" numeric(15,2) NOT NULL,
  "budget_max" numeric(15,2) NOT NULL
);

CREATE TABLE "post_images" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "post_id" uuid NOT NULL,
  "storage_key" text NOT NULL,
  "sort_order" int NOT NULL DEFAULT 0
);

CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "post_id" uuid NOT NULL,
  "member_low_id" uuid NOT NULL,
  "member_high_id" uuid NOT NULL,
  "status" conversation_status NOT NULL DEFAULT 'OPEN',
  "last_message_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "conversation_id" uuid NOT NULL,
  "sender_id" uuid NOT NULL,
  "type" message_type NOT NULL,
  "content" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "expires_at" timestamptz NOT NULL
);

CREATE TABLE "attachments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "message_id" uuid NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "status" attachment_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "reputation_events" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "seller_id" uuid NOT NULL,
  "report_cycle_key" varchar(255) UNIQUE NOT NULL,
  "delta" numeric(2,1) NOT NULL,
  "before_score" numeric(2,1) NOT NULL,
  "after_score" numeric(2,1) NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "buyer_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "reason_code" report_reason_code NOT NULL,
  "description" text NOT NULL,
  "status" report_status NOT NULL DEFAULT 'WAITING_SELLER_RESPONSE',
  "response_deadline_at" timestamptz NOT NULL,
  "seller_response" text,
  "seller_evidence_keys" text[] NOT NULL DEFAULT ('{}'),
  "seller_responded_at" timestamptz,
  "resolved_by" uuid,
  "resolution_note" text,
  "is_early_reviewed" boolean NOT NULL DEFAULT false,
  "reputation_event_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "resolved_at" timestamptz
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "actor_type" actor_type NOT NULL,
  "actor_id" uuid,
  "action" varchar(255) NOT NULL,
  "target_type" varchar(100) NOT NULL,
  "target_id" uuid NOT NULL,
  "details" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "phone_reveal_events" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "viewer_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "revealed_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "recipient_id" uuid NOT NULL,
  "type" varchar(100) NOT NULL,
  "title" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "reference_type" varchar(100),
  "reference_id" uuid,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "system_configs" (
  "config_key" varchar(100) PRIMARY KEY,
  "config_value" text NOT NULL,
  "description" text,
  "updated_by" uuid,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX "idx_posts_feed" ON "posts" ("status", "post_type", "category_id", "province", "created_at");

CREATE INDEX "idx_posts_owner" ON "posts" ("owner_id");

CREATE INDEX "idx_sell_details_price" ON "sell_details" ("price");

CREATE INDEX "idx_buy_details_budget" ON "buy_request_details" ("budget_min", "budget_max");

CREATE UNIQUE INDEX "uq_conversation_post_members" ON "conversations" ("post_id", "member_low_id", "member_high_id");

CREATE INDEX "idx_messages_conversation" ON "messages" ("conversation_id", "created_at");

CREATE INDEX "idx_messages_expires_at" ON "messages" ("expires_at");

CREATE INDEX "idx_attachments_expires_at" ON "attachments" ("expires_at");

CREATE INDEX "uq_active_report_per_buyer" ON "reports" ("buyer_id", "post_id", "reason_code");

CREATE INDEX "idx_reports_deadline" ON "reports" ("response_deadline_at");

CREATE INDEX "idx_phone_reveal_lookup" ON "phone_reveal_events" ("viewer_id", "post_id", "seller_id");

CREATE INDEX "idx_notifications_recipient" ON "notifications" ("recipient_id", "is_read", "created_at");

COMMENT ON COLUMN "users"."school_email" IS 'Email trường đuôi edu.vn (BR-02)';

COMMENT ON COLUMN "users"."reputation_score" IS 'CHECK: 0.0 <= reputation_score <= 5.0';

COMMENT ON COLUMN "users"."no_response_count" IS 'CHECK: >= 0. Bộ đếm NO_RESPONSE (BR-16)';

COMMENT ON COLUMN "otp_verifications"."code_hash" IS 'Không lưu plain text';

COMMENT ON COLUMN "student_evidences"."card_image_ref" IS 'Private, chỉ Admin được xem (BR-03)';

COMMENT ON COLUMN "student_evidences"."reason" IS 'Lý do từ chối nếu REJECTED';

COMMENT ON COLUMN "categories"."id" IS 'VD: TEXTBOOK, ELECTRONICS, HOUSEHOLD...';

COMMENT ON COLUMN "posts"."post_type" IS 'Bất biến sau khi tạo (BR-05)';

COMMENT ON COLUMN "posts"."status" IS 'BR-07: BUY_REQUEST không dùng SOLD';

COMMENT ON COLUMN "sell_details"."price" IS 'CHECK: price > 0';

COMMENT ON COLUMN "buy_request_details"."budget_min" IS 'CHECK: budget_min >= 0';

COMMENT ON COLUMN "buy_request_details"."budget_max" IS 'CHECK: budget_max >= budget_min';

COMMENT ON COLUMN "conversations"."member_low_id" IS 'CHECK: member_low_id < member_high_id';

COMMENT ON COLUMN "messages"."content" IS 'Cho phép NULL khi hết hạn 3 tháng để giữ metadata (BR-11)';

COMMENT ON COLUMN "messages"."expires_at" IS 'created_at + 3 tháng';

COMMENT ON COLUMN "attachments"."size_bytes" IS 'CHECK: <= 10485760 (10MB - BR-10)';

COMMENT ON COLUMN "attachments"."expires_at" IS 'message.created_at + 1 tháng (BR-11)';

COMMENT ON COLUMN "reputation_events"."report_cycle_key" IS 'Chống trừ điểm trùng chu kỳ';

COMMENT ON COLUMN "reputation_events"."delta" IS '-0.1 mỗi chu kỳ K';

COMMENT ON COLUMN "reports"."buyer_id" IS 'CHECK: buyer_id <> seller_id';

COMMENT ON COLUMN "reports"."is_early_reviewed" IS 'Admin xử lý sớm vi phạm nghiêm trọng (BR-14)';

COMMENT ON COLUMN "system_configs"."config_key" IS 'Lưu 9 tham số cấu hình Mục 11.1';

ALTER TABLE "student_evidences" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "student_evidences" ADD FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "user_preferences" ("user_id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "posts" ADD FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "posts" ADD FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "posts" ADD FOREIGN KEY ("id") REFERENCES "sell_details" ("post_id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "posts" ADD FOREIGN KEY ("id") REFERENCES "buy_request_details" ("post_id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "post_images" ADD FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations" ADD FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations" ADD FOREIGN KEY ("member_low_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations" ADD FOREIGN KEY ("member_high_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages" ADD FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages" ADD FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("message_id") REFERENCES "messages" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reputation_events" ADD FOREIGN KEY ("seller_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reports" ADD FOREIGN KEY ("buyer_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reports" ADD FOREIGN KEY ("seller_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reports" ADD FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reports" ADD FOREIGN KEY ("resolved_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reports" ADD FOREIGN KEY ("reputation_event_id") REFERENCES "reputation_events" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "phone_reveal_events" ADD FOREIGN KEY ("viewer_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "phone_reveal_events" ADD FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "phone_reveal_events" ADD FOREIGN KEY ("seller_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "system_configs" ADD FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
