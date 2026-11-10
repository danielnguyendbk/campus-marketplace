@echo off
chcp 65001 >nul
title Campus Marketplace - Monorepo Launcher
cd /d "%~dp0"

echo ======================================================================
echo    CAMPUS MARKETPLACE - NỀN TẢNG THƯƠNG MẠI ĐIỆN TỬ SINH VIÊN
echo    Tech Stack: Next.js 14 (App Router) + NestJS 10 + Supabase PostgreSQL
echo ======================================================================
echo.

:: 1. Tự động kiểm tra và cấu hình pnpm
where pnpm >nul 2>nul
if errorlevel 1 (
    if exist "C:\Users\Admin\AppData\Local\nvm\v20.20.1" (
        set "PATH=C:\Users\Admin\AppData\Local\nvm\v20.20.1;%PATH%"
    ) else (
        call corepack enable
    )
)

:: 2. Menu tác vụ
echo Chọn tác vụ bạn muốn chạy:
echo   [1] Chạy cả Backend & Frontend song song (pnpm dev) - KHUYẾN NGHỊ
echo   [2] Chỉ chạy Backend NestJS API (Port 3000)
echo   [3] Chỉ chạy Frontend Next.js Client (Port 3001)
echo   [4] Kiểm tra kết nối CSDL Supabase (pnpm db:test)
echo   [5] Chạy toàn bộ 50 Unit Tests (pnpm test)
echo   [6] Chạy 38 Backend E2E Tests (pnpm test:e2e)
echo   [7] Cài đặt dependencies (pnpm install)
echo   [0] Thoát
echo.

choice /c 12345670 /t 5 /d 1 /m "Nhập lựa chọn [1-7, 0] (Tự động chạy [1] sau 5s): "
set opt=%errorlevel%

if "%opt%"=="1" (
    echo.
    echo [*] Đang khởi động Backend (Port 3000) và Frontend (Port 3001)...
    echo [*] Backend API: http://localhost:3000/api/v1 (Health: http://localhost:3000/health)
    echo [*] Frontend Web: http://localhost:3001
    echo.
    pnpm dev
    goto end
)

if "%opt%"=="2" (
    echo.
    echo [*] Đang khởi động Backend NestJS API (Port 3000)...
    echo [*] API Base: http://localhost:3000/api/v1
    echo [*] Health Check: http://localhost:3000/health
    echo.
    pnpm --filter @campus/backend dev
    goto end
)

if "%opt%"=="3" (
    echo.
    echo [*] Đang khởi động Frontend Next.js Client...
    echo [*] Web URL: http://localhost:3001
    echo.
    pnpm --filter @campus/frontend dev
    goto end
)

if "%opt%"=="4" (
    echo.
    echo [*] Đang kiểm tra kết nối CSDL Supabase...
    pnpm db:test
    pause
    goto end
)

if "%opt%"=="5" (
    echo.
    echo [*] Đang chạy toàn bộ 50 Unit & Component Tests...
    pnpm test
    pause
    goto end
)

if "%opt%"=="6" (
    echo.
    echo [*] Đang chạy 38 Backend E2E Tests...
    pnpm test:e2e
    pause
    goto end
)

if "%opt%"=="7" (
    echo.
    echo [*] Đang cài đặt thư viện dependencies...
    pnpm install
    pause
    goto end
)

:end

