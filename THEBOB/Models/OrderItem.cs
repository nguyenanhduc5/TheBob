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
        public string ProductName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Sku { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Size { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Color { get; set; } = string.Empty;

        [MaxLength(500)]
        public string ProductImage { get; set; } = string.Empty;

        public ICollection<ProductReview> ProductReviews { get; set; } = new List<ProductReview>();
    }
}
