-- Rollback Migration 0001: DBML Review Architectural Fixes

BEGIN;

-- 1. Rollback soft-delete columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "deleted_at";

-- 2. Rollback CHECK constraints
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "chk_conversations_member_order";
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "chk_reports_buyer_diff_seller";
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "chk_attachments_size_bytes";
ALTER TABLE "buy_request_details" DROP CONSTRAINT IF EXISTS "chk_buy_request_budget_max";
ALTER TABLE "buy_request_details" DROP CONSTRAINT IF EXISTS "chk_buy_request_budget_min";
ALTER TABLE "sell_details" DROP CONSTRAINT IF EXISTS "chk_sell_details_price";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "chk_users_no_response_count";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "chk_users_reputation_score";

-- 3. Rollback index
DROP INDEX IF EXISTS "uq_active_report_per_buyer";
CREATE INDEX "uq_active_report_per_buyer" ON "reports" ("buyer_id", "post_id", "reason_code");

COMMIT;

