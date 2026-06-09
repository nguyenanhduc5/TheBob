using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    public class OrderItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int OrderId { get; set; }

        [ForeignKey("OrderId")]
        public Order Order { get; set; } = null!;

        // Link to variant (nullable to preserve order history even if variant deleted)
        public int? VariantId { get; set; }

        [ForeignKey("VariantId")]
        public ProductVariant? Variant { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int Quantity { get; set; }

        [Required]
        [Range(0, 9999999.99)]
        public decimal PricePerItem { get; set; } // Frozen price at purchase time

        [Required]
        [MaxLength(255)]
        public string StaticProductName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string StaticSize { get; set; } = string.Empty;

        [MaxLength(100)]
        public string StaticColor { get; set; } = string.Empty;
    }
}