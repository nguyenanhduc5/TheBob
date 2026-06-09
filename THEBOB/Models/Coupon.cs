using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    public class Coupon
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Code { get; set; } = string.Empty;

        [Required]
        public string DiscountType { get; set; } = "Percentage"; // Percentage or Fixed_Amount

        [Required]
        [Column(TypeName = "decimal(12,2)")]
        public decimal DiscountValue { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal MinOrderValue { get; set; } = 0;

        [Column(TypeName = "decimal(12,2)")]
        public decimal? MaxDiscountAmount { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public int UsageLimit { get; set; } = 0;
        public int UsedCount { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
