# Database Seeds

Thư mục chứa các script chèn dữ liệu khởi tạo (danh mục chuẩn, tài khoản quản trị mặc định, tham số hệ thống) dùng cho môi trường Development và Testing.

## Thứ tự thực thi

1. `01_categories_seed.sql`: Danh mục hàng hóa sinh viên cơ bản (5 danh mục: TEXTBOOK, ELECTRONICS, FURNITURE, APPLIANCES, OTHER).
2. `02_admin_user_seed.sql`: Tài khoản Quản trị viên (ADMIN) mặc định phục vụ xét duyệt xác minh sinh viên và quản trị hệ thống.
3. `03_system_configs_seed.sql`: Các cấu hình mặc định (hạn OTP, điểm uy tín ban đầu).

## Thông tin tài khoản Admin mặc định (Dev / Test)

- **Email:** `admin@ptithcm.edu.vn`
- **Mật khẩu mặc định:** `Admin@123456`
- **Vai trò (`role`):** `ADMIN`
- **Trạng thái (`verification_status`):** `APPROVED`
- **Điểm uy tín:** `5.0`

### Lệnh chạy Seed nhanh:
```bash
pnpm db:seed:admin
```

## Lưu ý

- Không commit dữ liệu chứa mật khẩu thực tế hoặc thông tin cá nhân của người dùng thực lên git.
- Các lệnh chèn dữ liệu luôn sử dụng `ON CONFLICT DO UPDATE` để có thể chạy lại nhiều lần mà không bị lỗi.
