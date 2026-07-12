using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Context đầu vào của Promotion Engine.
    /// Chứa toàn bộ thông tin cần thiết để tính giảm giá.
    /// </summary>
    public class PromotionContext
    {
        /// <summary>User đang mua hàng</summary>
        public int UserId { get; set; }

        /// <summary>Thông tin user (group, birthday, order count)</summary>
        public PromotionUserInfo User { get; set; } = new();

        /// <summary>Các item trong cart</summary>
        public List<PromotionCartItem> CartItems { get; set; } = new();

        /// <summary>Phí vận chuyển (trước giảm)</summary>
        public decimal ShippingFee { get; set; } = 0;

        /// <summary>Mã coupon user nhập (null nếu không nhập)</summary>
        public string? CouponCode { get; set; }

        /// <summary>ID của UserCoupon nếu user chọn voucher cá nhân</summary>
        public int? UserCouponId { get; set; }

        // ── Computed (sẽ được set bởi Engine) ────────────────────────────────

        /// <summary>Tổng giá trị sản phẩm (trước giảm)</summary>
        public decimal Subtotal => CartItems.Sum(i => i.LineTotal);

        /// <summary>Tổng số lượng sản phẩm</summary>
        public int TotalQuantity => CartItems.Sum(i => i.Quantity);
    }

    public class PromotionUserInfo
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public int? CustomerGroupId { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public decimal TotalSpent { get; set; }

        /// <summary>Số đơn hàng thành công trước đó</summary>
        public int PreviousOrderCount { get; set; }

        public bool IsNewUser => PreviousOrderCount == 0;
        public bool IsBirthMonth => DateOfBirth.HasValue && DateOfBirth.Value.Month == DateOnly.FromDateTime(DateTime.UtcNow).Month;
    }

    public class PromotionCartItem
    {
        public int VariantId { get; set; }
        public int ProductId { get; set; }
        public int? CategoryId { get; set; }
        public int? BrandId { get; set; }
        public string Sku { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal LineTotal => UnitPrice * Quantity;
    }

    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Kết quả tính toán của Promotion Engine</summary>
    public class PromotionResult
    {
        public decimal Subtotal { get; set; }
        public decimal ShippingFee { get; set; }

        /// <summary>Tổng giảm từ Automatic promotions</summary>
        public decimal AutomaticDiscount { get; set; } = 0;

        /// <summary>Tổng giảm từ Coupon/Voucher</summary>
        public decimal CouponDiscount { get; set; } = 0;

        /// <summary>Giảm phí ship</summary>
        public decimal ShippingDiscount { get; set; } = 0;

        /// <summary>Tổng tất cả giảm</summary>
        public decimal TotalDiscount => AutomaticDiscount + CouponDiscount + ShippingDiscount;

        /// <summary>Phí ship sau giảm</summary>
        public decimal FinalShipping => Math.Max(0, ShippingFee - ShippingDiscount);

        /// <summary>Số tiền cuối cùng</summary>
        public decimal FinalAmount => Math.Max(0, Subtotal - AutomaticDiscount - CouponDiscount + FinalShipping);

        /// <summary>Danh sách từng promotion đã áp dụng (để lưu snapshot)</summary>
        public List<AppliedPromotionInfo> AppliedPromotions { get; set; } = new();

        /// <summary>Coupon code đã áp dụng (nếu có)</summary>
        public string? AppliedCouponCode { get; set; }

        /// <summary>Có promotion nào được áp dụng không</summary>
        public bool HasDiscount => TotalDiscount > 0;
    }

    public class AppliedPromotionInfo
    {
        public int? PromotionId { get; set; }
        public string PromotionName { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal DiscountApplied { get; set; }
        public string? CouponCode { get; set; }
        public string PromotionTypeName { get; set; } = string.Empty;
    }
}
