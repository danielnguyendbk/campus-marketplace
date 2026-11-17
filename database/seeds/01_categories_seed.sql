-- Seed data for categories table (Campus Marketplace v1.2)
INSERT INTO "categories" ("id", "name", "slug", "is_active", "sort_order")
VALUES
  ('TEXTBOOK', 'Sách và giáo trình', 'textbooks', true, 1),
  ('ELECTRONICS', 'Thiết bị điện tử & Phụ kiện', 'electronics', true, 2),
  ('FURNITURE', 'Nội thất & Đồ dùng phòng trọ', 'furniture', true, 3),
  ('APPLIANCES', 'Đồ gia dụng sinh viên', 'appliances', true, 4),
  ('OTHER', 'Đồ dùng khác', 'other', true, 5)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "is_active" = EXCLUDED."is_active",
    "sort_order" = EXCLUDED."sort_order";
