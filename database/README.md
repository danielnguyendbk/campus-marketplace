# Campus Marketplace - Database Module

Thư mục quản lý toàn bộ cấu trúc cơ sở dữ liệu PostgreSQL cho dự án Campus Marketplace v1.2 trên Supabase.

## Cấu trúc thư mục

```text
database/
├── AGENTS.md            # Quy tắc vận hành và bảo vệ database dành cho AI Agent
├── README.md            # Tài liệu tổng quan
├── baseline/            # Schema gốc ban đầu đã chốt (v1.2, 18 bảng)
│   ├── schema_v1.2.sql  # File DDL SQL v1.2
│   └── README.md
├── migrations/          # Các migration gia tăng có phiên bản (0002_...)
│   └── README.md
├── seeds/               # Dữ liệu hạt giống cho môi trường dev/test
│   ├── 01_categories_seed.sql
│   └── README.md
└── schema/              # Tài liệu mô tả các bảng, quan hệ, kiểu dữ liệu
    └── README.md
```

## Kết nối Database (Supabase)

Backend truy cập PostgreSQL qua thư viện `pg` (Node-postgres) theo mô hình SQL-first có Connection Pooling. Biến môi trường kết nối được cấu hình trong `.env`:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
PGSSL=true # hoặc false nếu dev cục bộ
```
