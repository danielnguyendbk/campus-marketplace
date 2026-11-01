-- Seed data for categories table (Campus Marketplace v1.2)
INSERT INTO "categories" ("name", "description")
VALUES
  ('Giáo trình & Sách học tập', 'Sách giáo trình đại học, đề cương, sách tham khảo các ngành'),
  ('Thiết bị điện tử & Phụ kiện', 'Laptop, màn hình, chuột, bàn phím, sạc, tai nghe'),
  ('Đồ dùng phòng trọ', 'Quạt, ấm siêu tốc, bàn gấp, giá sách, tủ vải, móc treo'),
  ('Phương tiện di chuyển', 'Xe đạp, xe đạp điện, mũ bảo hiểm, phụ kiện xe máy'),
  ('Thời trang & Phụ kiện sinh viên', 'Áo đồng phục, balo, giày dép, túi xách đi học'),
  ('Đồ dùng học tập & Văn phòng phẩm', 'Máy tính Casio, dụng cụ vẽ kỹ thuật, sổ tay, bút thước')
ON CONFLICT ("name") DO NOTHING;
