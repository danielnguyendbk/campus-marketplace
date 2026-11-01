# Database Seeds

Thư mục chứa các script chèn dữ liệu khởi tạo (danh mục chuẩn, tham số hệ thống mặc định) dùng cho môi trường Development và Testing.

## Thứ tự thực thi

1. `01_categories_seed.sql`: Danh mục hàng hóa sinh viên cơ bản.
2. `02_system_configs_seed.sql`: Các cấu hình mặc định (hạn OTP, điểm uy tín ban đầu).

## Lưu ý

- Không commit dữ liệu chứa mật khẩu thực tế hoặc thông tin cá nhân của người dùng lên git.
- Các lệnh chèn dữ liệu nên dùng `ON CONFLICT DO NOTHING` hoặc `ON CONFLICT DO UPDATE` để tránh lỗi khi chạy lại nhiều lần.
