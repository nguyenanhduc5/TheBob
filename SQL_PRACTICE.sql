-- =========================================================================
-- HỌC TẬP VÀ THỰC HÀNH SQL TRÊN CƠ SỞ DỮ LIỆU DỰ ÁN THEBOB (MYSQL)
-- File này chứa các câu lệnh SQL mẫu tương ứng với các chương học của bạn
-- áp dụng trực tiếp trên cấu trúc bảng thực tế của dự án.
-- =========================================================================

-- =========================================================================
-- 2.1. JOINS & UNIONS (Chương 1 / Kết hợp dữ liệu)
-- =========================================================================

-- [A] INNER JOIN & LEFT JOIN: Lấy thông tin sản phẩm cùng với danh mục và thương hiệu
-- Giúp kết hợp dữ liệu từ 3 bảng: Products, Categories và Brands
SELECT 
    p.Id AS ProductId,
    p.Name AS ProductName,
    c.Name AS CategoryName,
    b.Name AS BrandName,
    p.Rating,
    p.ReviewCount
FROM Products p
INNER JOIN Categories c ON p.CategoryId = c.Id
LEFT JOIN Brands b ON p.BrandId = b.Id
WHERE p.IsDeleted = 0 AND p.IsAvailable = 1;

-- [B] UNION: Gộp danh sách các sản phẩm đang hiển thị (Available) 
-- và danh sách các sản phẩm đã bị ẩn/đã xóa (để làm báo cáo tổng hợp)
SELECT Id, Name, 'AVAILABLE' AS ProductStatus FROM Products WHERE IsAvailable = 1 AND IsDeleted = 0
UNION
SELECT Id, Name, 'DISABLED/DELETED' AS ProductStatus FROM Products WHERE IsAvailable = 0 OR IsDeleted = 1
ORDER BY Name ASC;


-- =========================================================================
-- 2.2. AGGREGATIONS WITH WHERE (Hàm tổng hợp kết hợp mệnh đề WHERE)
-- =========================================================================

-- [A] Thống kê doanh thu theo từng phương thức thanh toán
-- Sử dụng SUM, COUNT, AVG kết hợp với mệnh đề WHERE để lọc các đơn hàng đã thanh toán thành công
SELECT 
    PaymentMethod,
    COUNT(Id) AS TotalOrders,
    SUM(TotalAmount) AS TotalRevenue,
    AVG(TotalAmount) AS AverageOrderValue
FROM Orders
WHERE PaymentStatus = 'Paid' -- Hoặc trạng thái tương ứng trong dự án
GROUP BY PaymentMethod;

-- [B] Thống kê điểm đánh giá trung bình của từng sản phẩm có trên 1 lượt đánh giá
SELECT 
    ProductId,
    COUNT(Id) AS TotalReviews,
    AVG(Rating) AS AverageRating,
    MAX(Rating) AS HighestRating,
    MIN(Rating) AS LowestRating
FROM ProductReviews
WHERE CreatedAt >= '2026-01-01 00:00:00' -- Chỉ lọc các đánh giá trong năm 2026
GROUP BY ProductId
HAVING TotalReviews > 1;


-- =========================================================================
-- 2.3. WINDOW FUNCTIONS (Hàm cửa sổ - Chương 4 nâng cao)
-- =========================================================================

-- [A] ROW_NUMBER() OVER: Xếp hạng sản phẩm theo Rating giảm dần trong từng Danh mục (Category)
-- Phân vùng dữ liệu (PARTITION BY) theo CategoryId và sắp xếp (ORDER BY) theo Rating
SELECT 
    p.CategoryId,
    c.Name AS CategoryName,
    p.Id AS ProductId,
    p.Name AS ProductName,
    p.Rating,
    ROW_NUMBER() OVER (
        PARTITION BY p.CategoryId 
        ORDER BY p.Rating DESC, p.ReviewCount DESC
    ) AS RatingRankInGroup
FROM Products p
INNER JOIN Categories c ON p.CategoryId = c.Id
WHERE p.IsDeleted = 0;

-- [B] DENSE_RANK() OVER: Xếp hạng các đơn hàng của từng Khách hàng theo giá trị giảm dần
-- Giúp tìm ra đơn hàng lớn nhất của từng khách hàng và vị trí xếp hạng của nó
SELECT 
    o.UserId,
    o.OrderNumber,
    o.TotalAmount,
    o.CreatedAt,
    DENSE_RANK() OVER (
        PARTITION BY o.UserId 
        ORDER BY o.TotalAmount DESC
    ) AS OrderValueRank
FROM Orders o
WHERE o.Status != 4; -- Loại bỏ đơn hàng bị hủy (Status = 4 / Cancelled)


-- =========================================================================
-- 2.4. CTEs (Common Table Expressions - Chương 4 nâng cao)
-- =========================================================================

-- [A] Sử dụng CTE để tìm danh sách khách hàng VIP (có tổng chi tiêu > 1,000,000 VND)
-- và chi tiết đơn hàng cuối cùng của họ
WITH UserTotalSpending AS (
    -- CTE 1: Tính tổng số tiền và số đơn hàng của mỗi User
    SELECT 
        UserId,
        COUNT(Id) AS OrderCount,
        SUM(TotalAmount) AS TotalSpent
    FROM Orders
    WHERE PaymentStatus = 'Paid'
    GROUP BY UserId
),
RecentOrders AS (
    -- CTE 2: Lấy đơn hàng gần nhất của mỗi User sử dụng Window Function
    SELECT 
        UserId,
        OrderNumber,
        TotalAmount,
        CreatedAt,
        ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY CreatedAt DESC) AS rn
    FROM Orders
)
-- Truy vấn chính: Kết hợp 2 CTE trên để ra báo cáo VIP Customers
SELECT 
    u.Id AS CustomerId,
    u.Name AS CustomerName,
    s.OrderCount,
    s.TotalSpent,
    r.OrderNumber AS LastOrderNumber,
    r.TotalAmount AS LastOrderAmount,
    r.CreatedAt AS LastOrderDate
FROM UserTotalSpending s
INNER JOIN Users u ON s.UserId = u.Id
INNER JOIN RecentOrders r ON r.UserId = u.Id AND r.rn = 1
WHERE s.TotalSpent >= 1000000.00 -- Điều kiện lọc khách hàng VIP
ORDER BY s.TotalSpent DESC;
