using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>
    /// Snapshot các Promotion đã áp dụng cho một Order.
    /// Dữ liệu này bất biến — dù Promotion bị sửa/xóa sau này, Order vẫn giữ đúng.
    /// </summary>
    public class OrderPromotion
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int OrderId { get; set; }

        [ForeignKey(nameof(OrderId))]
        public Order Order { get; set; } = null!;

        /// <summary>
        /// FK tới Promotion (nullable — null nếu promotion đã bị xóa).
        /// Thông tin chi tiết được snapshot vào các cột bên dưới.
        /// </summary>
        public int? PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion? Promotion { get; set; }

        // ── Snapshot (bất biến) ───────────────────────────────────────────────

        [Required]
        [MaxLength(200)]
        public string PromotionName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string DiscountType { get; set; } = string.Empty; // "Percentage", "FixedAmount"...

        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountValue { get; set; }

        [MaxLength(100)]
        public string? CouponCode { get; set; }

        /// <summary>Số tiền thực tế đã giảm từ promotion này</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountApplied { get; set; }

        /// <summary>Loại: "Automatic", "Coupon", "FreeShipping"...</summary>
        [MaxLength(50)]
        public string PromotionType { get; set; } = string.Empty;

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    }
}
