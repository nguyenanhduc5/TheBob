using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>
    /// Bảng trung tâm của Promotion Engine.
    /// Gộp cả Coupon, AutoPromotion, FlashSale, Voucher, Member, Birthday.
    /// </summary>
    public class Promotion
    {
        [Key]
        public int Id { get; set; }

        // ── Thông tin cơ bản ─────────────────────────────────────────────────

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string BannerUrl { get; set; } = string.Empty;

        [Required]
        public PromotionType Type { get; set; } = PromotionType.Automatic;

        [Required]
        public PromotionStatus Status { get; set; } = PromotionStatus.Draft;

        // ── Priority + Stacking ───────────────────────────────────────────────

        /// <summary>
        /// Ưu tiên xử lý. Số cao hơn = ưu tiên hơn.
        /// Flash Sale = 100, Voucher = 80, Category = 50, Product = 40, AllShop = 20.
        /// </summary>
        public int Priority { get; set; } = 20;

        /// <summary>
        /// Có thể cộng dồn với promotion khác không.
        /// false = Exclusive — chỉ promotion này chạy (theo priority).
        /// true = Stackable — cộng dồn với các promotion stackable khác.
        /// </summary>
        public bool IsStackable { get; set; } = false;

        /// <summary>
        /// Số lượng promotion tối đa có thể stack cùng lúc (0 = không giới hạn).
        /// Chỉ có hiệu lực khi IsStackable = true.
        /// </summary>
        public int MaxStackCount { get; set; } = 0;

        /// <summary>
        /// Exclusive group — các promotion cùng group không stack được với nhau.
        /// Ví dụ: group "shipping" thì chỉ 1 free-ship promo được áp dụng.
        /// Để trống = không thuộc group nào.
        /// </summary>
        [MaxLength(100)]
        public string ExclusiveGroup { get; set; } = string.Empty;

        // ── Kiểu giảm giá ────────────────────────────────────────────────────

        [Required]
        public DiscountKind DiscountType { get; set; } = DiscountKind.Percentage;

        /// <summary>% hoặc số tiền cố định tùy DiscountType</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountValue { get; set; } = 0;

        /// <summary>Trần giảm tối đa (null = không giới hạn)</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal? MaxDiscountAmount { get; set; }

        // ── BuyXGetY config ───────────────────────────────────────────────────

        /// <summary>Mua bao nhiêu (BuyXGetY)</summary>
        public int BuyQuantity { get; set; } = 0;

        /// <summary>Tặng bao nhiêu (BuyXGetY)</summary>
        public int GetQuantity { get; set; } = 0;

        /// <summary>Tặng sản phẩm nào (null = tặng item rẻ nhất trong cart)</summary>
        public int? GetProductId { get; set; }

        // ── Điều kiện đơn hàng ───────────────────────────────────────────────

        [Column(TypeName = "decimal(12,2)")]
        public decimal MinOrderValue { get; set; } = 0;

        [Column(TypeName = "decimal(12,2)")]
        public decimal? MaxOrderValue { get; set; }

        /// <summary>Số lượng sản phẩm tối thiểu trong cart</summary>
        public int MinQuantity { get; set; } = 0;

        // ── Thời gian ────────────────────────────────────────────────────────

        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime EndDate { get; set; } = DateTime.UtcNow.AddYears(1);

        // ── Giới hạn sử dụng ─────────────────────────────────────────────────

        /// <summary>Tổng lượt dùng tối đa toàn hệ thống (0 = không giới hạn)</summary>
        public int UsageLimitTotal { get; set; } = 0;

        /// <summary>Số lần dùng tối đa mỗi user (0 = không giới hạn)</summary>
        public int UsageLimitPerUser { get; set; } = 1;

        /// <summary>Số lần dùng tối đa mỗi ngày (0 = không giới hạn)</summary>
        public int UsageLimitPerDay { get; set; } = 0;

        /// <summary>Số lần dùng tối đa mỗi tháng (0 = không giới hạn)</summary>
        public int UsageLimitPerMonth { get; set; } = 0;

        /// <summary>Đếm tổng số lần đã dùng — denormalized để query nhanh</summary>
        public int UsedCount { get; set; } = 0;

        // ── Phạm vi áp dụng ──────────────────────────────────────────────────

        [Required]
        public PromotionScope Scope { get; set; } = PromotionScope.AllShop;

        // ── Coupon Code ───────────────────────────────────────────────────────

        /// <summary>
        /// Mã coupon (chỉ dùng khi Type = Coupon).
        /// null hoặc empty = Automatic.
        /// </summary>
        [MaxLength(100)]
        public string? CouponCode { get; set; }

        /// <summary>Voucher cá nhân — gắn với từng user qua UserCoupons</summary>
        public bool IsPersonal { get; set; } = false;

        // ── Điều kiện user ───────────────────────────────────────────────────

        /// <summary>Chỉ dành cho khách hàng mới (chưa có đơn nào)</summary>
        public bool RequiresNewUser { get; set; } = false;

        /// <summary>Chỉ dành cho user có trong CustomerGroup nào đó</summary>
        public bool RequiresCustomerGroup { get; set; } = false;

        /// <summary>Chỉ dành cho user có sinh nhật trong tháng hiện tại</summary>
        public bool RequiresBirthdayUser { get; set; } = false;

        // ── Audit ─────────────────────────────────────────────────────────────

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(200)]
        public string CreatedBy { get; set; } = string.Empty;

        // ── Navigation ────────────────────────────────────────────────────────

        public ICollection<PromotionProduct> PromotionProducts { get; set; } = new List<PromotionProduct>();
        public ICollection<PromotionCategory> PromotionCategories { get; set; } = new List<PromotionCategory>();
        public ICollection<PromotionBrand> PromotionBrands { get; set; } = new List<PromotionBrand>();
        public ICollection<PromotionCustomerGroup> PromotionCustomerGroups { get; set; } = new List<PromotionCustomerGroup>();
        public ICollection<UserCoupon> UserCoupons { get; set; } = new List<UserCoupon>();
        public ICollection<PromotionUsage> PromotionUsages { get; set; } = new List<PromotionUsage>();
        public ICollection<OrderPromotion> OrderPromotions { get; set; } = new List<OrderPromotion>();
    }
}
