using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using THEBOB.Models.Promotion;

namespace THEBOB.Models
{
    public enum OrderStatus
    {
        Pending = 0,
        Processing = 1,
        Paid = 2,
        Shipped = 3,
        Delivered = 4,
        Cancelled = 5,
        PendingPayment = 6
    }

    public class Order
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string OrderNumber { get; set; } = string.Empty;

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        public OrderStatus Status { get; set; } = OrderStatus.Pending;

        // ── Promotion & Pricing Breakdown ─────────────────────────────────────

        /// <summary>Tổng giá trị sản phẩm trước khi giảm</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal SubtotalAmount { get; set; } = 0;

        /// <summary>Tổng giảm từ Automatic Promotion</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal PromotionDiscount { get; set; } = 0;

        /// <summary>Tổng giảm từ Coupon do user nhập</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal CouponDiscount { get; set; } = 0;

        /// <summary>Giảm phí vận chuyển</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal ShippingDiscount { get; set; } = 0;

        /// <summary>Tổng tất cả giảm giá = PromotionDiscount + CouponDiscount + ShippingDiscount</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal TotalDiscount { get; set; } = 0;

        /// <summary>Số tiền cuối cùng user phải trả = SubtotalAmount + ShippingFee - TotalDiscount</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal FinalAmount { get; set; } = 0;

        /// <summary>
        /// TotalAmount giữ nguyên để backward-compat với payment flow hiện tại.
        /// = FinalAmount (denormalized).
        /// </summary>
        [Required]
        [Column(TypeName = "decimal(12,2)")]
        public decimal TotalAmount { get; set; }

        [MaxLength(500)]
        public string ShippingAddress { get; set; } = string.Empty;

        [MaxLength(100)]
        public string PaymentMethod { get; set; } = string.Empty;

        [MaxLength(50)]
        public string PaymentStatus { get; set; } = "Pending"; // Pending, Completed, Failed, Refunded

        // ── Legacy Coupon (backward-compat — will be removed in future) ─────────
        // Dùng OrderPromotions thay thế.
        public int? CouponId { get; set; }

        [ForeignKey("CouponId")]
        public Coupon? Coupon { get; set; }

        /// <summary>Tổng tiền đã giảm (denormalized = TotalDiscount)</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountAmount { get; set; } = 0;

        /// <summary>Mã coupon đã dùng (denormalized — snapshot)</summary>
        [MaxLength(100)]
        public string? CouponCode { get; set; }

        /// <summary>Mã coupon từ Promotion Engine mới (snapshot)</summary>
        [MaxLength(100)]
        public string? AppliedCouponCode { get; set; }

        /// <summary>JSON snapshot toàn bộ promotions đã áp dụng — dùng để hiển thị trong order detail.</summary>
        [Column(TypeName = "longtext")]
        public string? PromotionSnapshot { get; set; }

        // ───────────────────────────────────────────────────────────────────
        // GHN / Vận chuyển
        // ───────────────────────────────────────────────────────────────────

        /// <summary>
        /// Phí vận chuyển thực tế tính từ GHN (CalculateFeeAsync) lúc tạo order.
        /// KHÔNG hard-code nữa — đây là số tiền thật đã cộng vào TotalAmount.
        /// </summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal ShippingFee { get; set; } = 0;

        /// <summary>
        /// Mã Tỉnh/Thành theo hệ thống GHN (ProvinceID trả về từ GET /shipping/provinces).
        /// KHÔNG dùng mã từ provinces.open-api.vn — 2 hệ thống mã khác nhau, không tương thích.
        /// </summary>
        public int? GhnProvinceId { get; set; }

        /// <summary>
        /// Mã Quận/Huyện theo hệ thống GHN (DistrictID).
        /// Bắt buộc phải có giá trị này mới gọi được CalculateFeeAsync / CreateShippingOrderAsync.
        /// </summary>
        public int? GhnDistrictId { get; set; }

        /// <summary>
        /// Mã Phường/Xã theo hệ thống GHN (WardCode — là string, không phải số).
        /// </summary>
        [MaxLength(20)]
        public string? GhnWardCode { get; set; }

        /// <summary>
        /// Mã vận đơn GHN trả về sau khi gọi CreateShippingOrderAsync thành công.
        /// Null nghĩa là chưa tạo đơn vận chuyển thật (đang chờ thanh toán, hoặc GHN lỗi cần admin tạo tay).
        /// </summary>
        [MaxLength(50)]
        public string? GhnOrderCode { get; set; }

        /// <summary>
        /// Trạng thái vận chuyển mới nhất từ GHN: ready_to_pick, picking, delivering, delivered...
        /// Được cập nhật bởi GhnWebhook trong ShippingController hoặc khi tạo đơn (mặc định "ready_to_pick").
        /// </summary>
        [MaxLength(50)]
        public string? ShippingStatus { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();
        public ICollection<OrderPromotion> OrderPromotions { get; set; } = new List<OrderPromotion>();
        public ICollection<PromotionUsage> PromotionUsages { get; set; } = new List<PromotionUsage>();
    }
}