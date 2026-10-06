using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>Promotion chỉ áp dụng cho CustomerGroup cụ thể</summary>
    public class PromotionCustomerGroup
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion Promotion { get; set; } = null!;

        [Required]
        public int CustomerGroupId { get; set; }

        [ForeignKey(nameof(CustomerGroupId))]
        public CustomerGroup CustomerGroup { get; set; } = null!;
    }
}
