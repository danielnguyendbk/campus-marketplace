-- Migration 0001: DBML Review Architectural Fixes
-- Reference: Campus_Marketplace_WBS_v0.3_DBML_Review.xlsx (Items DB01, DB02, DB03, DB07)
-- Description: Fix active reports unique constraint, enforce real SQL CHECK constraints, add soft-delete

BEGIN;

-- 1. DB01: Chống report trùng đang mở bằng Partial UNIQUE INDEX
DROP INDEX IF EXISTS "uq_active_report_per_buyer";
CREATE UNIQUE INDEX "uq_active_report_per_buyer" ON "reports" ("buyer_id", "post_id")
WHERE "status" IN ('WAITING_SELLER_RESPONSE', 'UNDER_REVIEW');

-- 2. DB03: Thực thi các ràng buộc CHECK thực tế trong PostgreSQL
ALTER TABLE "users"
  ADD CONSTRAINT "chk_users_reputation_score" CHECK ("reputation_score" >= 0.0 AND "reputation_score" <= 5.0),
  ADD CONSTRAINT "chk_users_no_response_count" CHECK ("no_response_count" >= 0);

ALTER TABLE "sell_details"
  ADD CONSTRAINT "chk_sell_details_price" CHECK ("price" > 0);

ALTER TABLE "buy_request_details"
  ADD CONSTRAINT "chk_buy_request_budget_min" CHECK ("budget_min" >= 0),
  ADD CONSTRAINT "chk_buy_request_budget_max" CHECK ("budget_max" >= "budget_min");

ALTER TABLE "attachments"
  ADD CONSTRAINT "chk_attachments_size_bytes" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760);

ALTER TABLE "reports"
  ADD CONSTRAINT "chk_reports_buyer_diff_seller" CHECK ("buyer_id" <> "seller_id");

-- 3. DB07: Đảm bảo thứ tự thành viên hội thoại member_low_id < member_high_id
ALTER TABLE "conversations"
  ADD CONSTRAINT "chk_conversations_member_order" CHECK ("member_low_id" < "member_high_id");

-- 4. DB02: Bổ sung cột soft-delete để bảo toàn lịch sử kiểm toán và báo cáo vi phạm
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz DEFAULT NULL;

COMMIT;
