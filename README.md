# 🛍️ THEBOB - Nền Tảng Thương Mại Điện Tử Thời Trang & AI Assistant

[![.NET](https://img.shields.io/badge/.NET-9.0-purple.svg)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://reactjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![SignalR](https://img.shields.io/badge/SignalR-Realtime-brightgreen.svg)](https://dotnet.microsoft.com/apps/aspnet/signalr)
[![Build Status](https://img.shields.io/badge/Build-Passing%20(0W%2F0E)-success.svg)]()

Hệ sinh thái E-commerce thời trang may mặc cao cấp tích hợp **Trợ lý tư vấn AI (LLM)**, hệ thống **Gợi ý sản phẩm thông minh (Apriori & FHM Engine)**, thanh toán tự động qua **SePay**, đối soát vận chuyển **Giao Hàng Nhanh (GHN)** và tương tác thời gian thực với **SignalR**.

---

## 🏛️ Kiến Trúc Hệ Thống (Architecture Overview)

Dự án được chuẩn hóa theo mô hình **Vertical Slice / Feature Folders Architecture** giúp code có tính độc lập cao, mở rộng linh hoạt và bảo trì dễ dàng.

```
THEBOB/
├── THEBOB/                                # ─── BACKEND (ASP.NET Core 9.0 Web API) ───
│   ├── Features/                          # Phân tách theo từng tính năng nghiệp vụ (Vertical Slice)
│   │   ├── Auth/                          # Đăng ký, đăng nhập, JWT, Refresh Token
│   │   ├── Products/                      # Tra cứu, chi tiết sản phẩm & Admin Product Management
│   │   ├── Categories/                    # Quản lý danh mục hàng hóa
│   │   ├── Cart/                          # Giỏ hàng & lưu trữ trạng thái người dùng
│   │   ├── Orders/                        # Xử lý đơn hàng, quy trình duyệt, hủy, giao hàng
│   │   ├── Payments/                      # Tích hợp cổng SePay, Webhook ngân hàng
│   │   ├── Shipping/                      # Tính phí vận chuyển & Tra cứu đơn GHN API
│   │   ├── Promotions/                    # Engine khuyến mãi, Voucher giảm giá, Flash Sale
│   │   ├── Coupons/                       # Quản lý mã giảm giá truyền thống
│   │   ├── Chat/                          # Tư vấn trực tuyến, Hỏi đáp FAQ, AI Chatbot (Groq/Llama)
│   │   ├── Blog/                          # Bài viết, tin tức, thông báo bài viết mới
│   │   ├── Recommendations/               # Thuật toán Apriori & High Utility Itemset Mining (FHM)
│   │   ├── Notifications/                 # Hệ thống thông báo người dùng & Quản trị viên
│   │   └── Users/                         # Quản lý tài khoản, hồ sơ khách hàng
│   ├── Infrastructure/                    # Cơ sở hạ tầng dùng chung
│   │   ├── BackgroundJobs/                # HostedServices & Queue xử lý ngầm độc lập (AI, Blog, Sale)
│   │   ├── Email/                         # Dịch vụ gửi email xác thực, thông báo (SendGrid/SMTP)
│   │   └── Shared/                        # DTO dùng chung, Helpers (SlugHelper), AppConstants
│   ├── Models/                            # Thực thể Entity Framework Core thuần túy
│   ├── Data/                              # DbContext (ThebobDbContext) & Cấu hình bảng
│   ├── Migrations/                        # EF Core Migrations
│   ├── Middlewares/                       # Global Exception Handling Middleware (Domain Exceptions)
│   ├── Exceptions/                        # Bộ Domain Exception chuẩn (NotFound, BadRequest, Conflict...)
│   └── Hubs/                              # SignalR Hubs (ChatHub, OrderHub)
│
├── frontend/                              # ─── FRONTEND (React 19 SPA) ───
│   └── src/
│       ├── pages/                         # Phân tầng trang theo vai trò và luồng nghiệp vụ
│       │   ├── admin/                     # 12 trang quản trị Admin (Dashboard, Products, Orders...)
│       │   ├── client/                    # 12 trang khách hàng (Home, Shop, Detail, Cart, Blog...)
│       │   ├── auth/                      # Trang xác thực (Login, Register, Profile)
│       │   └── payment/                   # Trang xử lý thanh toán (PaymentPage, Success, Failed...)
│       ├── components/                    # Tách bạch rõ ràng theo mục đích sử dụng
│       │   ├── layout/                    # Header, Footer, AdminLayout, Route Guards
│       │   ├── common/                    # Pagination, LoadingSkeleton, NotificationDisplay
│       │   ├── admin/product/             # ProductForm, ProductTable, VariantManager, ImageUpload
│       │   ├── promotion/                 # EligibleProductsModal...
│       │   ├── blog/                      # BlogPostEditor, BlogProductCard...
│       │   ├── chat/                      # ChatWidget, ChatWindow, MessageList, ProductContextCard
│       │   └── index.js                   # Barrel exports thuận tiện import
│       ├── api/                           # Axios Client & API Services gom nhóm
│       ├── context/                       # React Context (AuthContext, CartContext, NotificationContext)
│       ├── hooks/                         # Custom Hooks (useAddressSelect, useShippingFee)
│       └── styles/                        # CSS Modules & Stylesheets
│
└── THEBOB.Tests/                          # ─── UNIT & INTEGRATION TESTS (.NET 10/9) ───
```

---

## ⚡ Các Tính Năng Nổi Bật

1. **AI Chatbot & Live Chat Realtime**:
   - Tích hợp mô hình ngôn ngữ lớn (Llama 3 qua Groq/OpenAI compatible API) hỗ trợ tư vấn sản phẩm thông minh dựa trên context người dùng đang xem.
   - Hỗ trợ nhân viên tư vấn chat trực tiếp với khách qua SignalR `ChatHub`.
2. **Hệ Thống Gợi Ý Sản Phẩm (Recommendation Engine)**:
   - Thuật toán **Apriori**: Khai phá tập mục phổ biến và luật kết hợp mua kèm giữa các sản phẩm.
   - Thuật toán **FHM (Fast High-Utility Itemset Mining)**: Đề xuất sản phẩm đem lại lợi nhuận cao nhất cho doanh nghiệp dựa trên lịch sử mua hàng.
3. **Thanh Toán Ngân Hàng Tự Động (SePay)**:
   - Tự động tạo mã QR VietQR theo đơn hàng.
   - Webhook lắng nghe biến động số dư ngân hàng và cập nhật đơn hàng thành công theo thời gian thực (SignalR `OrderHub`).
4. **Tích Hợp Giao Hàng Nhanh (GHN)**:
   - Tự động đồng bộ Tỉnh/Thành, Quận/Huyện, Phường/Xã.
   - Tính toán cước vận chuyển chính xác theo trọng lượng, kích thước gói hàng và địa chỉ nhận.
5. **Động Cơ Khuyến Mãi & Voucher Đa Tầng**:
   - Hỗ trợ giảm giá theo %, số tiền cố định, freeship, điều kiện đơn tối thiểu.
   - Cơ chế giải quyết xếp chồng khuyến mãi (Promotion Stacking Resolver).
6. **Xử Lý Lỗi Tập Trung (Domain Exception Pattern)**:
   - Sử dụng các Exception miền nghiệp vụ: `NotFoundException` (404), `BadRequestException` (400), `ConflictException` (409), `UnauthorizedException` (401), `ForbiddenException` (403).
   - Middleware chuẩn hóa toàn bộ response lỗi về JSON đồng nhất:
     ```json
     {
       "success": false,
       "message": "Nội dung lỗi chi tiết",
       "data": null,
       "errors": null
     }
     ```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Môi Trường
- **.NET 9.0 SDK** (hoặc cao hơn)
- **Node.js** v18+ và **npm**
- **MySQL Server** 8.0+

---

### Bước 1: Cấu Hình Môi Trường & Cơ Sở Dữ Liệu

1. Tạo database trong MySQL:
   ```sql
   CREATE DATABASE thebob_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Cập nhật chuỗi kết nối trong `THEBOB/THEBOB/appsettings.json`:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Server=localhost;Port=3306;Database=thebob_db;User=root;Password=your_password;"
     },
     "Jwt": {
       "Key": "Chuoi_Secret_Key_Bao_Mat_Toi_Thieu_32_Ky_Tu_!!!",
       "Issuer": "THEBOB",
       "Audience": "THEBOB"
     },
     "SePay": {
       "ApiToken": "YOUR_SEPAY_API_TOKEN"
     },
     "GHN": {
       "Token": "YOUR_GHN_TOKEN",
       "ShopId": 123456
     },
     "OpenAI": {
       "ApiKey": "YOUR_GROQ_OR_OPENAI_KEY",
       "BaseUrl": "https://api.groq.com/openai/v1",
       "Model": "llama-3.1-8b-instant"
     }
   }
   ```

3. Cập nhật Database Schema bằng EF Core Migration:
   ```bash
   dotnet ef database update --project THEBOB/THEBOB/THEBOB.csproj
   ```

---

### Bước 2: Chạy Backend API

```bash
# Di chuyển vào thư mục dự án và chạy
dotnet run --project THEBOB/THEBOB/THEBOB.csproj
```
- API Endpoint: `http://localhost:5110`
- Swagger UI tài liệu API: `http://localhost:5110/swagger`

---

### Bước 3: Cấu Hình & Chạy Frontend

1. Cài đặt dependencies (chỉ cần chạy lần đầu):
   ```bash
   cd frontend
   npm install
   ```

2. Kiểm tra file cấu hình `frontend/.env`:
   ```env
   REACT_APP_API_URL=http://localhost:5110/api
   ```

3. Khởi động môi trường phát triển:
   ```bash
   npm start
   ```
- Ứng dụng web sẽ mở tại: `http://localhost:3000`

---

### Bước 4: Kiểm Tra & Chạy Unit Tests

```bash
dotnet test THEBOB.Tests/THEBOB.Tests.csproj
```

---

## 🔒 Tài Khoản Mặc Định (Seed Data)

Khi khởi tạo database ban đầu, tài khoản quản trị viên và người dùng thử nghiệm:
- **Admin**: `admin@thebob.com` / Mật khẩu: `Admin@123`
- **Customer**: `user@thebob.com` / Mật khẩu: `User@123`

---

## 🛠️ Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
|:---|:---|:---|
| **Lỗi CORS khi gọi API** | Frontend chạy ở port khác `localhost:3000` | Kiểm tra policy `AllowReactApp` trong `Program.cs` và bổ sung port của frontend. |
| **Không thể kết nối MySQL** | Sai mật khẩu hoặc dịch vụ MySQL chưa bật | Kiểm tra service MySQL trong Windows Services (`services.msc`) và kiểm tra lại `DefaultConnection`. |
| **SignalR Chat không kết nối** | Token JWT không được đính kèm vào query | Đảm bảo header hoặc accessTokenFactory trong SignalR client gửi đúng `localStorage.getItem('thebob-token')`. |
| **Build Frontend bị lỗi memory** | Bộ nhớ Node vượt giới hạn | Chạy `npm run build` sau khi dọn dẹp cache: `Remove-Item frontend\node_modules\.cache -Recurse -Force`. |

---

## 📄 Bản Quyền & Giấy Phép

Dự án thuộc bản quyền đội ngũ phát triển **THEBOB**. Mọi quyền được bảo lưu.