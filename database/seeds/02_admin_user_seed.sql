-- Seed data for default admin account (Campus Marketplace Development & Testing)
-- Email: admin@ptithcm.edu.vn
-- Default Password: Admin@123456
-- Role: ADMIN
-- Verification Status: APPROVED
-- Reputation Score: 5.0

INSERT INTO "users" (
  "id",
  "school_email",
  "password_hash",
  "display_name",
  "role",
  "verification_status",
  "reputation_score"
)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'admin@ptithcm.edu.vn',
  '$2b$12$zdXCfPaIgP1Q4l0Z7tEZyuXL9N/o5OGRygTwk6o.g54NRbnvTuwW.',
  'Quản trị viên Hệ thống',
  'ADMIN',
  'APPROVED',
  5.0
)
ON CONFLICT ("school_email") DO UPDATE
SET "role" = 'ADMIN',
    "verification_status" = 'APPROVED',
    "password_hash" = EXCLUDED."password_hash",
    "display_name" = EXCLUDED."display_name";

