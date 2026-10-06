using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>
    /// Lịch sử sử dụng Promotion của từng User trên từng Order.
    /// Dùng để kiểm tra usage limit và rollback khi hủy đơn.
    /// Thay thế CouponUsage cũ.
    /// </summary>
    public class PromotionUsage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion Promotion { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        [Required]
        public int OrderId { get; set; }

        [ForeignKey(nameof(OrderId))]
        public Order Order { get; set; } = null!;

        /// <summary>Số tiền đã giảm thực tế từ promotion này cho đơn hàng này</summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountApplied { get; set; } = 0;

        public DateTime UsedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// true = đã rollback (khi đơn bị hủy).
        /// Khi rollback: UsedCount trong Promotion giảm đi 1.
        /// </summary>
        public bool IsRolledBack { get; set; } = false;

        public DateTime? RolledBackAt { get; set; }
    }
}
