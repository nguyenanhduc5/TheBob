using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>Sản phẩm nằm trong phạm vi của Promotion</summary>
    public class PromotionProduct
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion Promotion { get; set; } = null!;

        [Required]
        public int ProductId { get; set; }

        [ForeignKey(nameof(ProductId))]
        public Product Product { get; set; } = null!;

        /// <summary>
        /// true = loại trừ sản phẩm này (blacklist).
        /// false = chỉ áp dụng cho sản phẩm này (whitelist).
        /// </summary>
        public bool IsExcluded { get; set; } = false;
    }
}
