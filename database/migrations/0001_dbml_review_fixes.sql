-- Migration 0001: DBML Review Architectural Fixes
-- Reference: Campus_Marketplace_WBS_v0.3_DBML_Review.xlsx (Items DB01, DB02, DB03, DB07)
-- Description: Fix active reports unique constraint, enforce real SQL CHECK constraints, add soft-delete

BEGIN;

-- 1. DB01: Chống report trùng đang mở bằng Partial UNIQUE INDEX (áp dụng cho cả SUBMITTED, WAITING_SELLER_RESPONSE, UNDER_REVIEW)
DROP INDEX IF EXISTS "uq_active_report_per_buyer";
CREATE UNIQUE INDEX "uq_active_report_per_buyer" ON "reports" ("buyer_id", "post_id")
WHERE "status" IN ('SUBMITTED', 'WAITING_SELLER_RESPONSE', 'UNDER_REVIEW');

-- 2. DB03 & DB07: Thực thi an toàn các ràng buộc CHECK thực tế trong PostgreSQL (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_reputation_score') THEN
    ALTER TABLE "users" ADD CONSTRAINT "chk_users_reputation_score" CHECK ("reputation_score" >= 0.0 AND "reputation_score" <= 5.0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_no_response_count') THEN
    ALTER TABLE "users" ADD CONSTRAINT "chk_users_no_response_count" CHECK ("no_response_count" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sell_details_price' OR conname = 'chk_sell_price') THEN
    ALTER TABLE "sell_details" ADD CONSTRAINT "chk_sell_details_price" CHECK ("price" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_buy_request_budget_min' OR conname = 'chk_buy_budget') THEN
    ALTER TABLE "buy_request_details" 
      ADD CONSTRAINT "chk_buy_request_budget_min" CHECK ("budget_min" >= 0),
      ADD CONSTRAINT "chk_buy_request_budget_max" CHECK ("budget_max" >= "budget_min");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_attachments_size_bytes' OR conname = 'chk_attachment_size') THEN
    ALTER TABLE "attachments" ADD CONSTRAINT "chk_attachments_size_bytes" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reports_buyer_diff_seller' OR conname = 'chk_report_not_self') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "chk_reports_buyer_diff_seller" CHECK ("buyer_id" <> "seller_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversations_member_order' OR conname = 'chk_conversation_members') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "chk_conversations_member_order" CHECK ("member_low_id" < "member_high_id");
  END IF;
END $$;

-- 3. DB02: Bổ sung cột soft-delete để bảo toàn lịch sử kiểm toán và báo cáo vi phạm
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz DEFAULT NULL;

COMMIT;

