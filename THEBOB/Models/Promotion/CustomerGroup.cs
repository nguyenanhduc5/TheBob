using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>
    /// Nhóm khách hàng (Customer Tier) — VIP, Silver, Gold, Platinum.
    /// User được xếp vào nhóm dựa trên TotalSpent hoặc admin gán thủ công.
    /// </summary>
    public class CustomerGroup
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // "VIP", "Silver", "Gold"

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Tổng chi tiêu tối thiểu để được xếp vào nhóm này (0 = admin gán thủ công).
        /// </summary>
        [Column(TypeName = "decimal(12,2)")]
        public decimal MinTotalSpent { get; set; } = 0;

        /// <summary>Màu sắc hiển thị (hex)</summary>
        [MaxLength(10)]
        public string BadgeColor { get; set; } = "#gold";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<PromotionCustomerGroup> PromotionCustomerGroups { get; set; } = new List<PromotionCustomerGroup>();
    }
}
