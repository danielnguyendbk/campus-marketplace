# Database Migrations

Thư mục này chứa các tệp tin SQL migration gia tăng phục vụ nâng cấp schema cơ sở dữ liệu sau mốc baseline v1.2.

## Quy ước đặt tên file

```text
XXXX_short_description.sql
```

Ví dụ:
- `0002_add_index_on_posts_category_id.sql`
- `0003_add_report_resolved_at_column.sql`

## Nguyên tắc viết Migration

1. **Khả năng chạy lại (Idempotency):** Ưu tiên sử dụng `IF NOT EXISTS` hoặc `IF EXISTS` khi tạo hoặc sửa chỉ mục/bảng.
2. **Tương thích ngược (Backward Compatibility):** Không xóa ngay cột đang được code backend đọc; áp dụng chiến lược Expand/Contract.
3. **Rollback:** Mỗi file migration nên có phần comment hoặc file rollback tương ứng (ví dụ: `0002_add_index_on_posts_category_id.down.sql`).
4. **Không chạy tự động trên production:** Mọi migration phải qua thẩm định của Backend Lead.
