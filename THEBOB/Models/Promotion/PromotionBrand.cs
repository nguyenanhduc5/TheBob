using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>Thương hiệu nằm trong phạm vi của Promotion</summary>
    public class PromotionBrand
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion Promotion { get; set; } = null!;

        [Required]
        public int BrandId { get; set; }

        [ForeignKey(nameof(BrandId))]
        public Brand Brand { get; set; } = null!;

        /// <summary>true = loại trừ | false = include</summary>
        public bool IsExcluded { get; set; } = false;
    }
}
