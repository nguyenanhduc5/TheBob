using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    public class Coupon
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Tên chương trình khuyến mãi (hiển thị cho user)</summary>
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Mã code để nhập. Để trống (empty string) khi IsAutomatic = true.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string Code { get; set; } = string.Empty;

        /// <summary>Percentage hoặc Fixed_Amount</summary>
        [Required]
        public string DiscountType { get; set; } = "Percentage";

        [Required]
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountValue { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal MinOrderValue { get; set; } = 0;

        [Column(TypeName = "decimal(12,2)")]
        public decimal? MaxDiscountAmount { get; set; }

        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime EndDate { get; set; } = DateTime.UtcNow.AddYears(1);

        public int UsageLimit { get; set; } = 0; // 0 = không giới hạn
        public int UsedCount { get; set; } = 0;

        /// <summary>
        /// true = tự động áp dụng, không cần nhập mã.
        /// false = cần nhập mã (default).
        /// </summary>
        public bool IsAutomatic { get; set; } = false;

        // ── Phạm vi áp dụng ───────────────────────────────────────────────

        /// <summary>Null = áp dụng toàn sàn. Có giá trị = chỉ sản phẩm cụ thể.</summary>
        public int? ProductId { get; set; }
        [ForeignKey("ProductId")]
        public Product? Product { get; set; }

        /// <summary>Null = không giới hạn danh mục. Có giá trị = chỉ sản phẩm trong danh mục đó.</summary>
        public int? CategoryId { get; set; }
        [ForeignKey("CategoryId")]
        public Category? Category { get; set; }

        /// <summary>Null = tất cả users. Có giá trị = chỉ user được chỉ định (voucher cá nhân).</summary>
        public int? TargetUserId { get; set; }
        [ForeignKey("TargetUserId")]
        public User? TargetUser { get; set; }

        // ── NotMapped helpers cho backwards-compat với frontend cũ ─────────

        [NotMapped]
        public decimal DiscountPercent
        {
            get => DiscountValue;
            set => DiscountValue = value;
        }

        [NotMapped]
        public DateTime? ExpiryDate
        {
            get => EndDate;
            set => EndDate = value ?? DateTime.UtcNow.AddYears(1);
        }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<CouponUsage> CouponUsages { get; set; } = new List<CouponUsage>();
    }
}
